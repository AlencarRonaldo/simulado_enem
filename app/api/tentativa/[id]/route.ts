import { NextResponse } from 'next/server';
import { estadoTentativa, respostasDaTentativa } from '@/lib/tentativa';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tentativa/:id
 *
 * O cliente chama isto ao abrir a prova e a cada 30s para RESSINCRONIZAR o
 * cronometro. O contador que o aluno ve e so enfeite: o tempo que vale e o
 * que vem daqui, calculado com o relogio do banco.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Identificador inválido.' }, { status: 400 });
  }

  const t = await estadoTentativa(id);
  if (!t) return NextResponse.json({ erro: 'Tentativa não encontrada.' }, { status: 404 });

  return NextResponse.json({
    id: t.id,
    nome: t.nome,
    ra: t.ra,
    sala: t.sala,
    titulo: t.titulo,
    restante_s: t.restante_s,
    finalizada: Boolean(t.finalizado_em),
    respostas: await respostasDaTentativa(id),
  });
}
