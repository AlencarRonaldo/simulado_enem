import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { estadoTentativa } from '@/lib/tentativa';

export const dynamic = 'force-dynamic';

/** POST /api/finalizar { tentativa_id } — entrega antes do tempo. Nao tem volta. */
export async function POST(req: Request) {
  let corpo: Record<string, string>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const tentativa_id = String(corpo.tentativa_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(tentativa_id)) {
    return NextResponse.json({ erro: 'Tentativa inválida.' }, { status: 400 });
  }

  const t = await estadoTentativa(tentativa_id);
  if (!t) return NextResponse.json({ erro: 'Tentativa não encontrada.' }, { status: 404 });

  // Ja finalizada (pelo aluno ou pelo tempo): responde ok, sem erro.
  // O cliente pode reenviar depois de uma falha de rede.
  if (!t.finalizado_em) {
    await q(
      `update tentativas set finalizado_em = now() where id = $1 and finalizado_em is null`,
      [tentativa_id],
    );
  }

  return NextResponse.json({ ok: true });
}
