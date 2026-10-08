import { q, q1 } from './db';
import type { Origem } from './metricas';

/**
 * Presencas por SEMANA: quem comecou, quem concluiu, quem abandonou.
 *
 * O relatorio de um simulado responde "como foi a prova de sexta". Isto
 * responde "quem esta fazendo o trabalho em casa" — a pergunta do professor
 * toda segunda-feira. Sempre filtrado por semana porque o treino livre gera
 * uma prova por aluno por dia, e listar tudo viraria uma parede.
 *
 * As datas sao convertidas para America/Sao_Paulo ANTES de comparar, porque
 * o banco guarda em UTC: sem isso uma prova feita domingo 22h apareceria na
 * semana errada (ou na anterior, quebrando o carimbo da semana letiva).
 */

const TZ = 'America/Sao_Paulo';

export type Situacao = 'concluiu' | 'em_andamento' | 'abandonou';

/**
 * O que "concluiu" quer dizer AQUI — e por que nao e `finalizado_em is not null`.
 *
 * Quando o relogio estoura sem o aluno entregar, ha dois caminhos e os dois
 * preenchem `finalizado_em`:
 *   - o aluno deixou a aba aberta: /api/finalizar roda e grava now()
 *   - o aluno fechou e voltou depois: estadoTentativa() grava
 *     `iniciado_em + duracao_min`, retroagindo o carimbo ao instante exato do fim
 * (lib/tentativa.ts:51-57). Nos dois casos o registro fica "finalizado", mas o
 * aluno nunca clicou em entregar. Contar isso como concluido inflaria o
 * placar com gente que abandonou a prova no meio.
 *
 * O corte entao e o tempo, nao o preenchimento: finalizado ANTES do limite
 * significa que houve clique de entrega com tempo sobrando. Em ou depois do
 * limite e o relogio fechando por conta propria. A tolerancia de 3s de
 * podeResponder nao recebe folga aqui de proposito: quem clica nos ultimos
 * segundos ja teve o tempo declarado esgotado pelo cronometro.
 */
function situacaoSQL(): string {
  return `case
            when t.finalizado_em is null
             and now() < t.iniciado_em + (t.duracao_min * interval '1 minute')
              then 'em_andamento'
            when t.finalizado_em is null
              then 'abandonou'
            when t.finalizado_em < t.iniciado_em + (t.duracao_min * interval '1 minute')
              then 'concluiu'
            else 'abandonou'
          end::text`;
}

export type Presenca = {
  tentativa_id: string;
  nome: string;
  ra: string;
  sala: string;
  simulado_id: string;
  titulo: string;
  automatico: boolean;
  comecou: string;
  terminou: string | null;
  situacao: Situacao;
  total: number;
  respondidas: number;
  acertos: number | null;
};

export type ResumoSemana = {
  alunos: number;
  provas: number;
  concluidas: number;
  em_andamento: number;
  abandonadas: number;
  percentual_medio: number | null;
};

export type SemanaDisponivel = {
  chave: string;    // '2026-W41'
  inicio: string;   // '2026-10-05'
  rotulo: string;   // '05/10 a 11/10/2026'
  provas: number;
  concluidas: number;
};

/** Mesmo filtro da secao de metricas, para os dois blocos concordarem. */
export type FiltroPresencas = { origem: Origem; sala: string };

/**
 * Onde comecar a semana (segunda-feira em Sao Paulo).
 *
 * O date_trunc e aplicado DEPOIS da conversao de fuso, nao antes: em UTC um
 * domingo 22h de Sao Paulo ja e segunda, e a prova cairia na semana errada.
 */
const INICIO_SEMANA = `date_trunc('week', t.iniciado_em at time zone '${TZ}')`;

/**
 * Condicao de filtro. Requer os aliases `t` (tentativas) e `s` (simulados) —
 * igual ao ALVO de metricas.ts, que e de onde este veio.
 *
 * `p` e o numero do primeiro placeholder: o Postgres reclama de parametro
 * declarado e nao usado ("could not determine data type of parameter"), entao
 * nao pode haver buraco na numeracao — cada query escolhe de onde comecar.
 *
 * @param p numero do placeholder de origem; sala e o seguinte.
 */
function ondeSQL(p: number): string {
  return `and ($${p}::text = 'todos' or s.automatico = ($${p} = 'treino'))
          and ($${p + 1}::text = '' or t.sala = $${p + 1})`;
}

/**
 * Semana atual em Sao Paulo, na mesma chave do banco ('2026-W41').
 * Calculada no banco, nao no Node: o relogio do servidor em serverless e
 * UTC, e um domingo 22h de Sao Paulo ja e segunda em UTC — trocaria a
 * semana do professor sem avisar.
 */
export async function semanaAtual(): Promise<{ chave: string; inicio: string }> {
  const r = await q1<{ chave: string; inicio: string }>(
    `select to_char(date_trunc('week', now() at time zone $1), 'IYYY-"W"IW') as chave,
            (date_trunc('week', now() at time zone $1))::date::text            as inicio`,
    [TZ],
  );
  return r ?? { chave: '', inicio: '' };
}

/**
 * '05/10 a 11/10/2026' a partir de uma segunda-feira.
 * Feito no Node com UTC puro de proposito: o Date do navegador fica em hora
 * local, e dia 5 UTC vira 4 em Brasilia — o rotulo da semana mudaria so de
 * abrir o painel num computador com fuso diferente.
 */
export function rotuloSemana(inicio: string): string {
  const ini = new Date(`${inicio}T12:00:00Z`);
  const fim = new Date(ini.getTime() + 6 * 86_400_000);
  const d = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${d(ini)} a ${d(fim)}/${fim.getUTCFullYear()}`;
}

/**
 * Semanas que tem alguma tentativa, mais recente primeiro. Conta so o que o
 * filtro alcanca: de nada adianta escolher "Treino" e ver no dropdown a
 * quantidade de um simulado da turma.
 */
export async function semanasDisponiveis(f: FiltroPresencas): Promise<SemanaDisponivel[]> {
  const rows = await q<{ chave: string; inicio: string; provas: number; concluidas: number }>(
    `select to_char(${INICIO_SEMANA}, 'IYYY-"W"IW')   as chave,
            min(${INICIO_SEMANA})::date::text          as inicio,
            count(*)::int                               as provas,
            count(*) filter (where t.finalizado_em is not null)::int as concluidas
       from tentativas t
       join simulados s on s.id = t.simulado_id
      where true ${ondeSQL(1)}
      group by 1
      order by min(${INICIO_SEMANA}) desc
      limit 24`,
    [f.origem, f.sala.trim()],
  );

  return rows.map((r) => ({
    chave: r.chave,
    inicio: r.inicio,
    rotulo: rotuloSemana(r.inicio),
    provas: r.provas,
    concluidas: r.concluidas,
  }));
}

/**
 * Placar da semana. Um RA que comecou 5 provas conta como 1 aluno: o que
 * interessa e "quem", nao "quantas vezes".
 *
 * As respostas entram por subquery, nao por join: um join multiplicaria a
 * tentativa pelas 90 respostas dela e transformaria 7 provas em 268.
 */
export async function resumoSemana(inicio: string, f: FiltroPresencas): Promise<ResumoSemana> {
  const r = await q1<ResumoSemana>(
    `with alvo as (
       select t.id, t.ra, ${situacaoSQL()} as situacao
         from tentativas t
         join simulados s on s.id = t.simulado_id
        where ${INICIO_SEMANA} = $1::date
          ${ondeSQL(2)}
     ),
     nota as (
       select r.tentativa_id,
              count(*)::int                                   as respondidas,
              count(*) filter (where r.letra = qu.gabarito)::int as acertos
         from respostas r
         join questoes qu on qu.id = r.questao_id
        where r.tentativa_id in (select id from alvo)
        group by r.tentativa_id
     )
     select count(distinct lower(btrim(a.ra)))::int as alunos,
            count(*)::int                            as provas,
            count(*) filter (where a.situacao = 'concluiu')::int      as concluidas,
            count(*) filter (where a.situacao = 'em_andamento')::int  as em_andamento,
            count(*) filter (where a.situacao = 'abandonou')::int     as abandonadas,
            round(
              100.0 * coalesce(sum(n.acertos), 0)
              / nullif(coalesce(sum(n.respondidas), 0), 0), 1
            )::float as percentual_medio
       from alvo a
       left join nota n on n.tentativa_id = a.id`,
    [inicio, f.origem, f.sala.trim()],
  );
  return r ?? { alunos: 0, provas: 0, concluidas: 0, em_andamento: 0, abandonadas: 0, percentual_medio: null };
}

/** A lista de quem apareceu na semana. Abandonados vao no fim, nao some. */
export async function presencas(inicio: string, f: FiltroPresencas): Promise<Presenca[]> {
  // A situacao nasce no CTE, nao so no SELECT final: o order by precisa dela
  // tambem, e uma coluna calculada so no select nao e visivel la.
  return q<Presenca>(
    `with alvo as (
       select t.id as tentativa_id, t.nome, t.ra, t.sala, t.simulado_id,
              s.titulo, s.automatico, t.duracao_min, t.iniciado_em, t.finalizado_em,
              count(sq.questao_id)::int as total,
              ${situacaoSQL()} as situacao
         from tentativas t
         join simulados s       on s.id = t.simulado_id
         left join simulado_questoes sq on sq.simulado_id = t.simulado_id
        where ${INICIO_SEMANA} = $1::date
          ${ondeSQL(2)}
        group by t.id, s.titulo, s.automatico, t.duracao_min, t.iniciado_em, t.finalizado_em
     )
     select a.tentativa_id, a.nome, a.ra, a.sala, a.simulado_id, a.titulo, a.automatico,
            to_char(a.iniciado_em   at time zone '${TZ}', 'DD/MM HH24:MI') as comecou,
            to_char(a.finalizado_em at time zone '${TZ}', 'DD/MM HH24:MI') as terminou,
            a.situacao,
            a.total,
            (select count(*)::int from respostas r where r.tentativa_id = a.tentativa_id) as respondidas,
            (select count(*)::int from respostas r
               join questoes qu on qu.id = r.questao_id
              where r.tentativa_id = a.tentativa_id and r.letra = qu.gabarito)::int as acertos
       from alvo a
      order by a.situacao <> 'concluiu',
               a.situacao <> 'em_andamento',
               a.iniciado_em desc`,
    [inicio, f.origem, f.sala.trim()],
  );
}
