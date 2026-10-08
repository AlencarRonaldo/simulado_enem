import { Pool } from 'pg';
import { sslPara } from './conexao';

// Um unico Pool por processo. Em serverless (Vercel) o modulo e reaproveitado
// entre invocacoes na mesma instancia, por isso guardamos em globalThis:
// sem isso cada hot reload em dev abre um pool novo e estoura as conexoes.
//
// Sem `prepare` no config de proposito: o pooler do Supabase (porta 6543,
// pgbouncer em modo transacao) nao sustenta prepared statement NOMEDO, que
// sobreviveria a troca de conexao. O pg so manda statement sem nome quando
// a query nao tem `name` (lib/query.js), e esses vivem dentro da propria
// transacao — entao funciona no pooler e fora dele, sem opcao extra.
const g = globalThis as unknown as { _pool?: Pool };

export const pool =
  g._pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslPara(process.env.DATABASE_URL),
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
