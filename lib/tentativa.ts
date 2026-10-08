import { q, q1 } from './db';
import type { Area } from './enem';

/**
 * Toda a logica de tempo vive aqui e SEMPRE usa o relogio do banco (now()).
 *
 * Por que nao o relogio do navegador: o aluno recarregaria a pagina e ganharia
 * o tempo inteiro de novo. Por que nao o relogio do servidor Node: em serverless
 * cada instancia tem seu proprio relogio e eles divergem. O banco e a unica
 * fonte de verdade que todos compartilham.
 */

export type EstadoTentativa = {
  id: string;
  simulado_id: string;
  nome: string;
  ra: string;
  sala: string;
  titulo: string;
  modo: string;
  duracao_min: number;
  iniciado_em: string;
  finalizado_em: string | null;
  restante_s: number;
  expirada: boolean;
};

const SQL_ESTADO = `
  select
    t.id, t.simulado_id, t.nome, t.ra, t.sala, t.duracao_min,
    t.iniciado_em, t.finalizado_em,
    s.titulo, s.modo,
    greatest(
      0,
      ceil(t.duracao_min * 60 - extract(epoch from (now() - t.iniciado_em)))
    )::int as restante_s
  from tentativas t
  join simulados s on s.id = t.simulado_id
  where t.id = $1
`;

/**
 * Le o estado da tentativa e, se o tempo acabou sem o aluno ter enviado,
 * finaliza automaticamente — carimbando o fim no instante exato em que o
 * tempo expirou, nao no momento em que alguem abriu a pagina.
 */
export async function estadoTentativa(id: string): Promise<EstadoTentativa | null> {
  const t = await q1<EstadoTentativa>(SQL_ESTADO, [id]);
  if (!t) return null;

  if (!t.finalizado_em && t.restante_s <= 0) {
    await q(
      `update tentativas
          set finalizado_em = iniciado_em + (duracao_min * interval '1 minute')
        where id = $1 and finalizado_em is null`,
      [id],
    );
    const r = await q1<EstadoTentativa>(SQL_ESTADO, [id]);
    return r ? { ...r, expirada: true } : null;
  }

  return { ...t, expirada: t.restante_s <= 0 };
}

/** Pode responder? Precisa estar aberta e com tempo. 3s de tolerancia para latencia. */
export function podeResponder(t: EstadoTentativa): boolean {
  return !t.finalizado_em && t.restante_s > -3;
}

/** Um pedaço de texto; `forte` marca o que estava em **negrito** no original. */
export type Parte = { texto: string; forte: boolean };

/** Bloco de conteúdo: um parágrafo de texto ou uma imagem no meio do texto. */
export type Bloco =
  | { tipo: 'paragrafo'; partes: Parte[] }
  | { tipo: 'imagem'; src: string };

export type QuestaoAluno = {
  ordem: number;
  id: string;
  ano: number;
  numero: number;
  area: Area;
  idioma: string | null;
  conteudo: Bloco[];
  enunciado: Bloco[];
  imagens_extra: string[];
  alternativas: { letra: string; blocos: Bloco[]; imagem: string | null }[];
};

/**
 * Questoes de um simulado SEM o gabarito.
 * O gabarito nunca sai do servidor durante a prova — se fosse no payload,
 * bastava abrir o DevTools para ver todas as respostas.
 */
export async function questoesDoSimulado(simuladoId: string): Promise<QuestaoAluno[]> {
  return q<QuestaoAluno>(
    `select sq.ordem, qu.id, qu.ano, qu.numero, qu.area, qu.idioma,
            qu.conteudo, qu.enunciado, qu.imagens_extra, qu.alternativas
       from simulado_questoes sq
       join questoes qu on qu.id = sq.questao_id
      where sq.simulado_id = $1
      order by sq.ordem`,
    [simuladoId],
  );
}

export async function respostasDaTentativa(id: string): Promise<Record<string, string>> {
  const rows = await q<{ questao_id: string; letra: string }>(
    `select questao_id, letra from respostas where tentativa_id = $1`,
    [id],
  );
  return Object.fromEntries(rows.map((r) => [r.questao_id, r.letra]));
}

export type Correcao = {
  total: number;
  respondidas: number;
  acertos: number;
  percentual: number;
  por_area: { area: string; total: number; acertos: number; percentual: number }[];
  itens: {
    ordem: number;
    questao_id: string;
    ano: number;
    numero: number;
    area: string;
    marcada: string | null;
    gabarito: string;
    acertou: boolean;
  }[];
};

/** Correcao feita no banco: o gabarito nunca passa pelo cliente. */
export async function corrigir(tentativaId: string): Promise<Correcao> {
  const itens = await q<{
    ordem: number; questao_id: string; ano: number; numero: number;
    area: string; marcada: string | null; gabarito: string;
  }>(
    `select sq.ordem, qu.id as questao_id, qu.ano, qu.numero, qu.area,
            r.letra as marcada, qu.gabarito
       from tentativas t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu on qu.id = sq.questao_id
       left join respostas r on r.tentativa_id = t.id and r.questao_id = qu.id
      where t.id = $1
      order by sq.ordem`,
    [tentativaId],
  );

  const comAcerto = itens.map((i) => ({ ...i, acertou: i.marcada === i.gabarito }));

  const porAreaMap = new Map<string, { total: number; acertos: number }>();
  for (const i of comAcerto) {
    const a = porAreaMap.get(i.area) ?? { total: 0, acertos: 0 };
    a.total++;
    if (i.acertou) a.acertos++;
    porAreaMap.set(i.area, a);
  }

  const acertos = comAcerto.filter((i) => i.acertou).length;
  const respondidas = comAcerto.filter((i) => i.marcada !== null).length;

  return {
    total: comAcerto.length,
    respondidas,
    acertos,
    percentual: comAcerto.length ? Math.round((acertos / comAcerto.length) * 1000) / 10 : 0,
    por_area: [...porAreaMap.entries()].map(([area, v]) => ({
      area,
      total: v.total,
      acertos: v.acertos,
      percentual: v.total ? Math.round((v.acertos / v.total) * 1000) / 10 : 0,
    })),
    itens: comAcerto,
  };
}
