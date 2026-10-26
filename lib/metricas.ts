import { q } from './db';
import type { Bloco } from './tentativa';

/**
 * Metricas GERAIS, cruzando todos os simulados: o que a turma mais errou e o
 * que mais acertou, para orientar a revisao da proxima aula.
 *
 * O relatorio de um simulado (/professor/relatorio/[id]) responde "como foi
 * a prova de sexta"; isto aqui responde "o que eu preciso retomar". Tudo
 * agregado no banco, como no relatorio — 300 alunos x 90 questoes sao 27 mil
 * respostas, e somar isso no Node seria lento e caro.
 */

export type Origem = 'turma' | 'treino' | 'todos';

export type FiltroMetricas = { origem: Origem; sala: string };

/**
 * Questao com menos de N respostas fica fora dos rankings: com 1 ou 2
 * respostas o percentual e ruido, nao sinal — e o treino livre gera muitas
 * provas de um aluno so.
 */
export const MIN_RESPOSTAS = 3;

export type ResumoMetricas = {
  tentativas: number;
  alunos: number;
  concluidas: number;
  respostas: number;
  acertos: number;
  percentual: number | null;
};

export type AreaMetrica = {
  area: string;
  respostas: number;
  acertos: number;
  percentual: number | null;
};

export type SalaMetrica = { sala: string; tentativas: number; percentual: number | null };

export type QuestaoMetrica = {
  questao_id: string;
  ano: number;
  numero: number;
  area: string;
  gabarito: string;
  trecho: string;
  respostas: number;
  acertos: number;
  percentual: number | null;
  distribuicao: Record<string, number>;
};

/**
 * CTE com as tentativas que o filtro alcanca. Todas as consultas comecam
 * por ele: origem 'turma' sao so simulados do professor, 'treino' sao so
 * provas que o aluno gerou sozinho, 'todos' e os dois; sala vazio e todas.
 */
const ALVO = `
  alvo as (
    select t.id, t.simulado_id, t.ra, t.sala, t.finalizado_em
      from tentativas t
      join simulados s on s.id = t.simulado_id
     where ($1::text = 'todos' or s.automatico = ($1 = 'treino'))
       and ($2::text = '' or t.sala = $2)
  )
`;

function params(f: FiltroMetricas): [Origem, string] {
  return [f.origem, f.sala.trim()];
}

export async function resumo(f: FiltroMetricas): Promise<ResumoMetricas> {
  const r = await q<ResumoMetricas>(
    `with ${ALVO}
     select count(distinct t.id)::int                               as tentativas,
            count(distinct lower(btrim(t.ra)))::int                  as alunos,
            count(distinct t.id) filter (where t.finalizado_em is not null)::int as concluidas,
            count(r.letra)::int                                     as respostas,
            count(*) filter (where r.letra = qu.gabarito)::int       as acertos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(r.letra), 0), 1
            )::float as percentual
       from alvo t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id`,
    params(f),
  );
  return r[0] ?? { tentativas: 0, alunos: 0, concluidas: 0, respostas: 0, acertos: 0, percentual: null };
}

/** Pior area primeiro: e por ali que a revisao costuma precisar comecar. */
export async function porArea(f: FiltroMetricas): Promise<AreaMetrica[]> {
  return q<AreaMetrica>(
    `with ${ALVO}
     select qu.area,
            count(r.letra)::int                                 as respostas,
            count(*) filter (where r.letra = qu.gabarito)::int   as acertos,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(r.letra), 0), 1
            )::float as percentual
       from alvo t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
      group by qu.area
      order by percentual asc nulls last`,
    params(f),
  );
}

export async function porSala(f: FiltroMetricas): Promise<SalaMetrica[]> {
  return q<SalaMetrica>(
    `with ${ALVO}
     select t.sala,
            count(distinct t.id)::int as tentativas,
            round(
              100.0 * count(*) filter (where r.letra = qu.gabarito)
              / nullif(count(r.letra), 0), 1
            )::float as percentual
       from alvo t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
      group by t.sala
      order by percentual asc nulls last`,
    params(f),
  );
}

const SQL_QUESTOES = `
  select qu.id as questao_id, qu.ano, qu.numero, qu.area, qu.gabarito,
         left(coalesce(qu.resumo, ''), 90)                          as trecho,
         count(r.letra)::int                                        as respostas,
         count(*) filter (where r.letra = qu.gabarito)::int          as acertos,
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
    from alvo t
    join simulado_questoes sq on sq.simulado_id = t.simulado_id
    join questoes qu          on qu.id = sq.questao_id
    left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
   group by qu.id
  having count(r.letra) >= ${MIN_RESPOSTAS}
`;

/** As que a turma mais errou — as candidatas naturais a revisao. */
export async function maisErradas(f: FiltroMetricas, limite = 12): Promise<QuestaoMetrica[]> {
  return q<QuestaoMetrica>(
    `with ${ALVO}
     ${SQL_QUESTOES}
      order by percentual asc, acertos asc, qu.ano desc
      limit $3`,
    [...params(f), limite],
  );
}

/** As que a turma mais acertou: o conteudo que ja esta assentado. */
export async function maisAcertadas(f: FiltroMetricas, limite = 8): Promise<QuestaoMetrica[]> {
  return q<QuestaoMetrica>(
    `with ${ALVO}
     ${SQL_QUESTOES}
      order by percentual desc, qu.ano desc
      limit $3`,
    [...params(f), limite],
  );
}

/** Salas que aparecem no filtro, ja filtradas pela origem escolhida. */
export async function salasDisponiveis(f: FiltroMetricas): Promise<string[]> {
  const r = await q<{ sala: string }>(
    `with ${ALVO}
     select distinct sala from alvo order by sala`,
    params(f),
  );
  return r.map((x) => x.sala);
}

/** Quantas questoes mais erradas cada area leva no plano de aula. */
export const QUESTOES_POR_AREA = 12;

/**
 * Questao do plano de aula: a metrica que ja existe (distribuicao, percentual)
 * COM o conteudo completo, para o professor abrir a questao e planejar a aula
 * sem precisar procurar o enunciado fora do sistema.
 */
export type QuestaoPlano = {
  questao_id: string;
  ano: number;
  numero: number;
  area: string;
  idioma: string | null;
  gabarito: string;
  resumo_completo: string;
  respostas: number;
  acertos: number;
  percentual: number | null;
  distribuicao: Record<string, number>;
  conteudo: Bloco[];
  enunciado: Bloco[];
  imagens_extra: string[];
  alternativas: { letra: string; blocos: Bloco[]; imagem: string | null }[];
};

/**
 * As QUESTOES_POR_AREA questoes mais erradas de CADA area do conhecimento,
 * numa unica query: o professor de cada disciplina abre so a secao dele e
 * sai com o material do plano de acao. Mesmo corte de MIN_RESPOSTAS das
 * metricas — com 1 ou 2 respostas o percentual e ruido, nao sinal.
 */
export async function erradasPorArea(
  f: FiltroMetricas,
  limite = QUESTOES_POR_AREA,
): Promise<QuestaoPlano[]> {
  return q<QuestaoPlano>(
    `with ${ALVO},
     base as (
       select qu.id as questao_id, qu.ano, qu.numero, qu.area, qu.idioma, qu.gabarito,
              coalesce(qu.resumo, '')                           as resumo_completo,
              qu.conteudo, qu.enunciado, qu.imagens_extra, qu.alternativas,
              count(r.letra)::int                               as respostas,
              count(*) filter (where r.letra = qu.gabarito)::int as acertos,
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
         from alvo t
         join simulado_questoes sq on sq.simulado_id = t.simulado_id
         join questoes qu          on qu.id = sq.questao_id
         left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
        group by qu.id
        having count(r.letra) >= ${MIN_RESPOSTAS}
     ),
     ranqueadas as (
       select *,
              row_number() over (
                partition by area order by percentual asc, acertos asc, ano desc
              )::int as rn
         from base
     )
     select questao_id, ano, numero, area, idioma, gabarito, resumo_completo,
            respostas, acertos, percentual, distribuicao,
            conteudo, enunciado, imagens_extra, alternativas
       from ranqueadas
      where rn <= $3
      order by area, rn`,
    [...params(f), limite],
  );
}
