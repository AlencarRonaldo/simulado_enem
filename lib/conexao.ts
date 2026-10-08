/**
 * Decide se a conexao usa SSL, a partir da propria DATABASE_URL.
 *
 * Supabase (e qualquer Postgres gerenciado) exige SSL. Um Postgres local
 * normalmente nao tem SSL ligado e recusa a conexao se o cliente insistir.
 * Sem esta checagem, testar localmente antes de subir nao funciona.
 *
 * rejectUnauthorized: false — o pooler do Supabase apresenta certificado
 * de uma CA que o Node nao traz por padrao. Isso protege o trafego, mas nao
 * verifica a identidade do servidor. Para exigir verificacao, baixe o
 * certificado do projeto e passe PGSSLROOTCERT apontando para ele.
 */
export function sslPara(url: string | undefined): false | { rejectUnauthorized: boolean } {
  if (!url) return false;

  let host = '';
  let params: URLSearchParams | null = null;
  try {
    const u = new URL(url);
    host = u.hostname;
    params = u.searchParams;
  } catch {
    return { rejectUnauthorized: false };
  }

  const modo = params?.get('sslmode');
  if (modo === 'disable') return false;
  if (modo && modo !== 'disable') return { rejectUnauthorized: modo === 'verify-full' };

  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  return local ? false : { rejectUnauthorized: false };
}
