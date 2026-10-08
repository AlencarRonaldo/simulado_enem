/**
 * Estrutura oficial do ENEM, usada para montar os simulados.
 *
 * Dia 1: Linguagens (45, das quais 5 de lingua estrangeira) + Humanas (45) = 90, 5h30
 * Dia 2: Natureza (45) + Matematica (45) = 90, 5h00
 *
 * A redacao do dia 1 NAO esta implementada neste sistema (so questoes objetivas).
 * Por isso o dia 1 usa 5h30, que e o tempo oficial do dia inteiro — mantido de
 * proposito para o aluno treinar a resistencia real da prova.
 */

export const AREAS = {
  linguagens: 'Linguagens, Códigos e suas Tecnologias',
  'ciencias-humanas': 'Ciências Humanas e suas Tecnologias',
  'ciencias-natureza': 'Ciências da Natureza e suas Tecnologias',
  matematica: 'Matemática e suas Tecnologias',
} as const;

export type Area = keyof typeof AREAS;

export const AREAS_LISTA = Object.keys(AREAS) as Area[];

export type Modo = 'dia1' | 'dia2' | 'area';

export const MODOS: Record<Modo, { nome: string; duracao_min: number; questoes: number }> = {
  dia1: { nome: 'Dia 1 completo — Linguagens + Humanas', duracao_min: 330, questoes: 90 },
  dia2: { nome: 'Dia 2 completo — Natureza + Matemática', duracao_min: 300, questoes: 90 },
  area: { nome: 'Área única — 45 questões', duracao_min: 90, questoes: 45 },
};

/** Quantas questoes de cada area cada modo leva. */
export function composicao(modo: Modo, area?: Area): { area: Area; n: number }[] {
  if (modo === 'dia1') {
    return [
      { area: 'linguagens', n: 45 },
      { area: 'ciencias-humanas', n: 45 },
    ];
  }
  if (modo === 'dia2') {
    return [
      { area: 'ciencias-natureza', n: 45 },
      { area: 'matematica', n: 45 },
    ];
  }
  if (!area) throw new Error('modo "area" exige uma area');
  return [{ area, n: 45 }];
}

/** Em Linguagens, 5 das 45 questoes sao de lingua estrangeira. */
export const QUESTOES_LINGUA_ESTRANGEIRA = 5;

export function nomeArea(a: string): string {
  return (AREAS as Record<string, string>)[a] ?? a;
}

// Percentual sempre com vírgula decimal: a interface é em português, e "22.2%"
// num boletim brasileiro parece erro de sistema. O CSV faz o mesmo.
const FORMATO_PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${FORMATO_PCT.format(n)}%`;
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(seg)}` : `${p(m)}:${p(seg)}`;
}
