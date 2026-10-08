import { NextResponse } from 'next/server';
import { COOKIE_PROF, senhaCorreta, tokenEsperado } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * A conexao e HTTPS?
 *
 * Decidido pela requisicao, nao por NODE_ENV. Marcar o cookie como Secure
 * baseado em NODE_ENV quebra silenciosamente quem roda `next start` num
 * servidor HTTP simples (o caso "rede local da escola"): o navegador aceita
 * o login, descarta o cookie e o professor volta para a tela de senha sem
 * nenhuma mensagem de erro. Na Vercel, que serve HTTPS e manda
 * x-forwarded-proto, o cookie continua Secure como deve ser.
 */
function conexaoSegura(req: Request): boolean {
  const encaminhado = req.headers.get('x-forwarded-proto');
  if (encaminhado) return encaminhado.split(',')[0].trim() === 'https';
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { senha } = await req.json().catch(() => ({ senha: '' }));

  if (!senhaCorreta(String(senha ?? ''))) {
    // Atraso pequeno para encarecer tentativa por forca bruta.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_PROF, tokenEsperado(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: conexaoSegura(req),
    path: '/',
    maxAge: 60 * 60 * 12, // 12h: cobre um dia de aula, expira sozinho
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_PROF);
  return res;
}
