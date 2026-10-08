import { NextResponse } from 'next/server';
import { q, q1 } from '@/lib/db';
import { estadoTentativa } from '@/lib/tentativa';
import { validarDadosAluno } from '@/lib/aluno';

export const dynamic = 'force-dynamic';

/**
 * POST /api/iniciar  { simulado_id, nome, ra, sala }
 *
 * A TRAVA POR RA e o retomar ficam aqui:
 *   - tentativa aberta para esse RA -> RETOMA (nao reinicia o cronometro).
 *     Isso e essencial: internet de escola cai, aluno fecha a aba sem querer.
 *   - tentativa ja finalizada        -> BLOQUEIA (409) e devolve o link do resultado.
 *   - nenhuma                        -> cria.
 */
export async function POST(req: Request) {
  let corpo: Record<string, string>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const simulado_id = String(corpo.simulado_id || '').trim();
  if (!simulado_id) return NextResponse.json({ erro: 'Escolha um simulado.' }, { status: 400 });

  const dados = validarDadosAluno(corpo);
  if (!dados.ok) return NextResponse.json({ erro: dados.erro }, { status: 400 });
  const { nome, ra, sala } = dados;

  const sim = await q1<{ id: string; duracao_min: number; ativo: boolean }>(
    `select id, duracao_min, ativo from simulados where id = $1`,
    [simulado_id],
  );
  if (!sim) return NextResponse.json({ erro: 'Simulado não encontrado.' }, { status: 404 });
  if (!sim.ativo) {
    return NextResponse.json({ erro: 'Este simulado está fechado pelo professor.' }, { status: 403 });
  }

  // Ja existe tentativa desse RA neste simulado?
  const existente = await q1<{ id: string }>(
    `select id from tentativas
      where simulado_id = $1 and lower(btrim(ra)) = lower(btrim($2))`,
    [simulado_id, ra],
  );

  if (existente) {
    const est = await estadoTentativa(existente.id);
    if (est && !est.finalizado_em) {
      return NextResponse.json({ tentativa_id: est.id, retomando: true });
    }
    return NextResponse.json(
      {
        erro: 'Este RA já concluiu este simulado. Fale com o professor se precisar refazer.',
        resultado_id: existente.id,
      },
      { status: 409 },
    );
  }

  try {
    const nova = await q1<{ id: string }>(
      `insert into tentativas (simulado_id, nome, ra, sala, duracao_min)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [simulado_id, nome, ra, sala, sim.duracao_min],
    );
    return NextResponse.json({ tentativa_id: nova!.id, retomando: false });
  } catch (e: unknown) {
    // 23505 = unique_violation: dois cliques simultaneos no mesmo RA.
    // Nao e erro para o aluno, e so retomar a que venceu a corrida.
    if (typeof e === 'object' && e && (e as { code?: string }).code === '23505') {
      const dup = await q1<{ id: string }>(
        `select id from tentativas
          where simulado_id = $1 and lower(btrim(ra)) = lower(btrim($2))`,
        [simulado_id, ra],
      );
      if (dup) return NextResponse.json({ tentativa_id: dup.id, retomando: true });
    }
    throw e;
  }
}

/** GET /api/iniciar -> simulados abertos, para a tela de entrada. */
export async function GET() {
  const rows = await q(
    `select s.id, s.titulo, s.modo, s.duracao_min,
            (select count(*)::int from simulado_questoes sq where sq.simulado_id = s.id) as questoes
       from simulados s
      where s.ativo = true
      order by s.criado_em desc`,
  );
  return NextResponse.json({ simulados: rows });
}
