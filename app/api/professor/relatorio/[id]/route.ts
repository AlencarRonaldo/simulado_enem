import { NextResponse } from 'next/server';
import { estaLogado } from '@/lib/auth';
import { relatorioCompleto } from '@/lib/relatorio';

export const dynamic = 'force-dynamic';

/** GET /api/professor/relatorio/:id — mesmos dados da página, em JSON. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await estaLogado())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
  }

  const r = await relatorioCompleto(id);
  if (!r) return NextResponse.json({ erro: 'Simulado não encontrado.' }, { status: 404 });

  return NextResponse.json(r);
}
