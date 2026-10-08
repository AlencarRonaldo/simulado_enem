import { NextResponse } from 'next/server';
import { pool, q } from '@/lib/db';
import { estaLogado } from '@/lib/auth';
import { AREAS_LISTA, MODOS, type Area, type Modo } from '@/lib/enem';
import { ProvaImpossivelError, sortearQuestoes } from '@/lib/montar-prova';

export const dynamic = 'force-dynamic';

async function barrar() {
  if (!(await estaLogado())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  return null;
}

/** GET — lista todos os simulados com contagem de tentativas. */
export async function GET() {
  const nao = await barrar();
  if (nao) return nao;

  const rows = await q(
    `select s.id, s.titulo, s.modo, s.duracao_min, s.ativo, s.criado_em, s.automatico,
            (select count(*)::int from simulado_questoes sq where sq.simulado_id = s.id) as questoes,
            (select count(*)::int from tentativas t where t.simulado_id = s.id) as tentativas,
            (select count(*)::int from tentativas t
              where t.simulado_id = s.id and t.finalizado_em is not null) as concluidas
       from simulados s
      order by s.criado_em desc`,
  );
  return NextResponse.json({ simulados: rows });
}

/**
 * POST — monta um simulado novo sorteando questoes.
 *   { titulo, modo: 'dia1'|'dia2'|'area', area?, idioma: 'ingles'|'espanhol',
 *     ano_min, ano_max, duracao_min? }
 *
 * A ordem das questoes segue a prova real (Linguagens 1-45, Humanas 46-90 etc.)
 * e e FIXA depois de criada: todos os alunos veem a mesma ordem, o que permite
 * comparar "questao 37" entre eles no relatorio.
 */
export async function POST(req: Request) {
  const nao = await barrar();
  if (nao) return nao;

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });

  const modo = String(b.modo) as Modo;
  if (!MODOS[modo]) return NextResponse.json({ erro: 'Modo inválido.' }, { status: 400 });

  const area = b.area ? (String(b.area) as Area) : undefined;
  if (modo === 'area' && (!area || !AREAS_LISTA.includes(area))) {
    return NextResponse.json({ erro: 'Escolha a área.' }, { status: 400 });
  }

  const idioma = b.idioma === 'espanhol' ? 'espanhol' : 'ingles';
  const anoMin = Number.isFinite(+b.ano_min) ? Math.trunc(+b.ano_min) : 2015;
  const anoMax = Number.isFinite(+b.ano_max) ? Math.trunc(+b.ano_max) : 2023;
  if (anoMin > anoMax) return NextResponse.json({ erro: 'Intervalo de anos inválido.' }, { status: 400 });

  const duracao = Number.isFinite(+b.duracao_min) && +b.duracao_min > 0
    ? Math.trunc(+b.duracao_min)
    : MODOS[modo].duracao_min;

  const titulo = String(b.titulo || '').trim() || `${MODOS[modo].nome} (${anoMin}–${anoMax})`;

  const client = await pool.connect();
  try {
    await client.query('begin');

    let escolhidas: string[];
    try {
      escolhidas = await sortearQuestoes(client, { modo, area, idioma, anoMin, anoMax });
    } catch (e) {
      if (e instanceof ProvaImpossivelError) {
        await client.query('rollback');
        return NextResponse.json({ erro: e.message }, { status: 400 });
      }
      throw e;
    }

    const sim = await client.query<{ id: string }>(
      `insert into simulados (titulo, modo, duracao_min) values ($1,$2,$3) returning id`,
      [titulo, modo, duracao],
    );
    const simId = sim.rows[0].id;

    // Um insert so, em lote: 90 queries de uma linha custam ~30s de latencia.
    const params: unknown[] = [];
    const valores = escolhidas.map((id, i) => {
      params.push(simId, i + 1, id);
      return `($${params.length - 2}, $${params.length - 1}, $${params.length})`;
    });
    await client.query(
      `insert into simulado_questoes (simulado_id, ordem, questao_id)
       values ${valores.join(', ')}`,
      params,
    );

    await client.query('commit');
    return NextResponse.json({ id: simId, titulo, questoes: escolhidas.length, duracao_min: duracao });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** PATCH — abre/fecha um simulado. { id, ativo } */
export async function PATCH(req: Request) {
  const nao = await barrar();
  if (nao) return nao;

  const { id, ativo } = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) {
    return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
  }
  await q(`update simulados set ativo = $2 where id = $1`, [id, Boolean(ativo)]);
  return NextResponse.json({ ok: true });
}
