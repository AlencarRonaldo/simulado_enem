import type { Pool, PoolClient } from 'pg';
import {
  QUESTOES_LINGUA_ESTRANGEIRA,
  composicao,
  type Area,
  type Modo,
} from './enem';

/**
 * Sorteio de uma prova, no padrao oficial do ENEM.
 *
 * Separado das rotas de proposito: o painel do professor monta simulados da
 * turma e o treino livre do aluno monta uma prova individual, mas as duas
 * coisas precisam sortear exatamente do mesmo jeito — senao "Dia 1" quer
 * dizer uma coisa para um aluno e outra para o professor.
 */
export type OpcoesProva = {
  modo: Modo;
  area?: Area;
  idioma: 'ingles' | 'espanhol';
  anoMin: number;
  anoMax: number;
};

/** Nao ha questoes suficientes para montar a prova pedida. Mensagem e para o usuario. */
export class ProvaImpossivelError extends Error {}

/**
 * Ids das questoes sorteadas, ja na ordem da prova (lingua estrangeira
 * primeiro, como na prova real). Roda com `order by random()`, que pede a
 * Postgres para baralhar de verdade — nao sortea no navegador, onde o
 * aluno poderia recarregar ate sair a resposta que queria.
 *
 * Chame dentro de uma transacao: as duas consultas de Linguagens leem o
 * mesmo estado e nada pode entrar no meio.
 */
export async function sortearQuestoes(
  db: Pool | PoolClient,
  o: OpcoesProva,
): Promise<string[]> {
  const escolhidas: string[] = [];

  for (const { area: a, n } of composicao(o.modo, o.area)) {
    if (a === 'linguagens') {
      // 5 de lingua estrangeira no idioma escolhido...
      const le = await db.query<{ id: string }>(
        `select id from questoes
          where area = 'linguagens' and idioma = $1 and ano between $2 and $3
          order by random() limit $4`,
        [o.idioma, o.anoMin, o.anoMax, QUESTOES_LINGUA_ESTRANGEIRA],
      );
      // ...e 40 sem idioma.
      const resto = await db.query<{ id: string }>(
        `select id from questoes
          where area = 'linguagens' and idioma is null and ano between $1 and $2
          order by random() limit $3`,
        [o.anoMin, o.anoMax, n - QUESTOES_LINGUA_ESTRANGEIRA],
      );
      if (le.rowCount! < QUESTOES_LINGUA_ESTRANGEIRA || resto.rowCount! < n - QUESTOES_LINGUA_ESTRANGEIRA) {
        throw new ProvaImpossivelError(
          `Questões insuficientes em Linguagens para ${o.anoMin}–${o.anoMax}: `
          + `${le.rowCount} de ${QUESTOES_LINGUA_ESTRANGEIRA} de ${o.idioma} e `
          + `${resto.rowCount} de ${n - QUESTOES_LINGUA_ESTRANGEIRA} das demais. `
          + `Amplie o intervalo de anos.`,
        );
      }
      // Lingua estrangeira vem no inicio, como na prova real (questoes 1-5).
      escolhidas.push(...le.rows.map((r) => r.id), ...resto.rows.map((r) => r.id));
    } else {
      const r = await db.query<{ id: string }>(
        `select id from questoes
          where area = $1 and ano between $2 and $3
          order by random() limit $4`,
        [a, o.anoMin, o.anoMax, n],
      );
      if (r.rowCount! < n) {
        throw new ProvaImpossivelError(
          `Questões insuficientes em ${a}: ${r.rowCount} disponíveis de ${n} necessárias `
          + `para ${o.anoMin}–${o.anoMax}. Amplie o intervalo de anos.`,
        );
      }
      escolhidas.push(...r.rows.map((x) => x.id));
    }
  }

  return escolhidas;
}
