import { Pool } from 'pg';
import { sslPara } from './conexao';

/**
 * O pooler do Supabase (porta 6543) nao sustenta prepared statements: ele
 * troca de conexao a cada transacao e a "declaracao preparada" morre junto
 * com a conexao, derrubando a query com um erro que nao explica o motivo.
 * Em serverless (Vercel) so existe o pooler, entao la e obrigatorio.
 */
function prepararStatements(url: string | undefined): boolean {
  if (!url) return true;
  try {
    return !new URL(url).hostname.includes('pooler');
  } catch {
    return true;
  }
}

// Um unico Pool por processo. Em serverless (Vercel) o modulo e reaproveitado
// entre invocacoes na mesma instancia, por isso guardamos em globalThis:
// sem isso cada hot reload em dev abre um pool novo e estoura as conexoes.
const g = globalThis as unknown as { _pool?: Pool };

export const pool =
  g._pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslPara(process.env.DATABASE_URL),
    prepare: prepararStatements(process.env.DATABASE_URL),
    max: 5,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') g._pool = pool;

export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function q1<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}
