import { q, q1 } from './db';

/**
 * Relatorio de um simulado. Tudo agregado no banco, nao em JavaScript:
 * 300 alunos x 90 questoes sao 27 mil respostas, e somar isso no Node seria
 * lento e caro. Usado tanto pela pagina /professor/relatorio quanto pela API.
 */

export type Aluno = {
  id: string; nome: string; ra: string; sala: string;
  iniciado_em: string; finalizado_em: string | null;
  total: number; respondidas: number; acertos: number;
  percentual: number | null; minutos_gastos: number | null;
};

export type AreaLinha = {
  area: string; questoes: number; respondidas: number;
  acertos: number; percentual_das_respondidas: number | null;
};

export type SalaLinha = { sala: string; alunos: number; percentual_medio: number | null };

export type QuestaoLinha = {
  ordem: number; questao_id: string; ano: number; numero: number;
  area: string; gabarito: string; trecho: string;
  respostas: number; acertos: number; percentual: number | null;
  distribuicao: Record<string, number>;
};

export type SimuladoInfo = {
  id: string; titulo: string; modo: string; duracao_min: number;
  ativo: boolean; criado_em: string; questoes: number;
};

export async function infoSimulado(id: string) {
  return q1<SimuladoInfo>(
    `select id, titulo, modo, duracao_min, ativo, criado_em,
            (select count(*)::int from simulado_questoes sq where sq.simulado_id = s.id) as questoes
       from simulados s where id = $1`,
    [id],
  );
}

export async function alunos(id: string) {
  return q<Aluno>(
    `select t.id, t.nome, t.ra, t.sala, t.iniciado_em, t.finalizado_em,
            count(sq.questao_id)::int                              as total,
            count(r.letra)::int                                     as respondidas,
            count(*) filter (where r.letra = qu.gabarito)::int       as acertos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(sq.questao_id), 0), 1
            )::float as percentual,
            case
              when t.finalizado_em is not null
                then round(extract(epoch from (t.finalizado_em - t.iniciado_em)) / 60)::int
              else null
            end as minutos_gastos
       from tentativas t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
      where t.simulado_id = $1
      group by t.id
      order by acertos desc, minutos_gastos asc nulls last`,
    [id],
  );
}

export async function porArea(id: string) {
  return q<AreaLinha>(
    `select qu.area,
            count(distinct sq.questao_id)::int                      as questoes,
            count(r.letra)::int                                      as respondidas,
            count(*) filter (where r.letra = qu.gabarito)::int        as acertos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(r.letra), 0), 1
            )::float as percentual_das_respondidas
       from simulado_questoes sq
       join questoes qu       on qu.id = sq.questao_id
       left join tentativas t on t.simulado_id = sq.simulado_id
       left join respostas r  on r.tentativa_id = t.id and r.questao_id = qu.id
      where sq.simulado_id = $1
      group by qu.area
      order by percentual_das_respondidas asc nulls last`,
    [id],
  );
}

export async function porSala(id: string) {
  return q<SalaLinha>(
    `select t.sala,
            count(distinct t.id)::int as alunos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(sq.questao_id), 0), 1
            )::float as percentual_medio
       from tentativas t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
      where t.simulado_id = $1
      group by t.sala
      order by percentual_medio desc nulls last`,
    [id],
  );
}

/**
 * Questoes ordenadas da mais errada para a mais acertada, com a distribuicao
 * das marcacoes: ver que a turma inteira caiu na MESMA alternativa errada diz
 * mais do que o percentual de acerto sozinho — e onde a aula precisa voltar.
 */
export async function porQuestao(id: string) {
  return q<QuestaoLinha>(
    `select sq.ordem, qu.id as questao_id, qu.ano, qu.numero, qu.area, qu.gabarito,
            left(coalesce(qu.resumo, ''), 110) as trecho,
            count(r.letra)::int                                      as respostas,
            count(*) filter (where r.letra = qu.gabarito)::int         as acertos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(r.letra), 0), 1
            )::float as percentual,
            jsonb_build_object(
              'A', count(*) filter (where r.letra = 'A'),
              'B', count(*) filter (where r.letra = 'B'),
              'C', count(*) filter (where r.letra = 'C'),
              'D', count(*) filter (where r.letra = 'D'),
              'E', count(*) filter (where r.letra = 'E')
            ) as distribuicao
       from simulado_questoes sq
       join questoes qu       on qu.id = sq.questao_id
       left join tentativas t on t.simulado_id = sq.simulado_id
       left join respostas r  on r.tentativa_id = t.id and r.questao_id = qu.id
      where sq.simulado_id = $1
      group by sq.ordem, qu.id
      order by percentual asc nulls last, sq.ordem`,
    [id],
  );
}

export async function relatorioCompleto(id: string) {
  const simulado = await infoSimulado(id);
  if (!simulado) return null;
  const [a, ar, sa, qu] = await Promise.all([
    alunos(id), porArea(id), porSala(id), porQuestao(id),
  ]);
  return { simulado, alunos: a, por_area: ar, por_sala: sa, questoes: qu };
}
