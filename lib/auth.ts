import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Autenticacao do professor: uma senha, guardada em SENHA_PROFESSOR (.env.local).
 *
 * O cookie nao guarda a senha, guarda o sha256 dela. Se o cookie vazar, nao
 * revela a senha — mas continua servindo de passe, entao o escopo e mesmo
 * "um professor, uma senha". Para varios professores com login proprio,
 * trocar isto por uma tabela de usuarios.
 *
 * O cookie e httpOnly: nao da para ler nem setar pelo console do navegador.
 */

const COOKIE = 'prof';

export function tokenEsperado(): string {
  const senha = process.env.SENHA_PROFESSOR;
  if (!senha) throw new Error('SENHA_PROFESSOR não configurada em .env.local');
  return createHash('sha256').update(senha).digest('hex');
}

export function senhaCorreta(tentativa: string): boolean {
  const a = createHash('sha256').update(tentativa).digest();
  const b = createHash('sha256').update(process.env.SENHA_PROFESSOR ?? '').digest();
  return timingSafeEqual(a, b) && Boolean(process.env.SENHA_PROFESSOR);
}

export async function estaLogado(): Promise<boolean> {
  try {
    const c = await cookies();
    const v = c.get(COOKIE)?.value;
    if (!v) return false;
    const esperado = tokenEsperado();
    if (v.length !== esperado.length) return false;
    return timingSafeEqual(Buffer.from(v), Buffer.from(esperado));
  } catch {
    return false;
  }
}

export const COOKIE_PROF = COOKIE;
