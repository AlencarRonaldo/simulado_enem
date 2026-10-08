/**
 * O que o aluno digita na tela de entrada: nome, RA e sala.
 *
 * Viva nas duas rotas que criam tentativa (/api/iniciar e /api/treino).
 * Se a regra mudar, mude nos dois lugares junto — a trava de RA e o
 * relatorio do professor dependem do RA estar limpo igual nos dois caminhos.
 */

export type DadosAluno = { nome: string; ra: string; sala: string };

export type ValidacaoAluno =
  | ({ ok: true } & DadosAluno)
  | { ok: false; erro: string };

export function validarDadosAluno(corpo: Record<string, unknown>): ValidacaoAluno {
  const nome = String(corpo.nome ?? '').trim().replace(/\s+/g, ' ');
  const ra = String(corpo.ra ?? '').trim();
  const sala = String(corpo.sala ?? '').trim();

  if (nome.length < 3) return { ok: false, erro: 'Digite seu nome completo.' };
  if (!/^[0-9A-Za-z.\-/]{4,20}$/.test(ra)) {
    return { ok: false, erro: 'RA inválido (4 a 20 caracteres, só números e letras).' };
  }
  if (!sala) return { ok: false, erro: 'Informe a sala.' };

  return { ok: true, nome, ra, sala };
}
