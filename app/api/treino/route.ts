import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { AREAS, AREAS_LISTA, MODOS, type Area, type Modo } from '@/lib/enem';
import { validarDadosAluno } from '@/lib/aluno';
import { ProvaImpossivelError, sortearQuestoes } from '@/lib/montar-prova';

export const dynamic = 'force-dynamic';

/** Anos do acervo deste sistema (o mesmo intervalo do painel do professor). */
const ANO_MIN = 2015;
const ANO_MAX = 2023;

function tituloTreino(modo: Modo, area?: Area): string {
  if (modo === 'area') return `Treino livre — ${AREAS[area!]}`;
  return `Treino livre — ${MODOS[modo].nome}`;
}

/**
 * POST /api/treino  { nome, ra, sala, modo, area?, idioma? }
 *
 * O aluno pede uma prova e o servidor sorteia na hora, no padrao do ENEM.
 *
 * Cada treino vira um simulado proprio, com `automatico = true` e
 * `ativo = false`:
 *   - nao aparece na lista da tela de entrada dos colegas;
 *   - a trava de RA e por simulado, entao o mesmo aluno pode fazer quantos
 *     treinos quiser sem falar com o professor;
 *   - cronometro, respostas, correcao e relatorio continuam os de sempre —
 *     a prova nao e um caso a parte, so nasce ja fechada para os outros.
 */
export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const dados = validarDadosAluno(corpo);
  if (!dados.ok) return NextResponse.json({ erro: dados.erro }, { status: 400 });

  const modo = String(corpo.modo || '') as Modo;
  if (!MODOS[modo]) return NextResponse.json({ erro: 'Escolha o tipo de prova.' }, { status: 400 });

  const area = corpo.area ? (String(corpo.area) as Area) : undefined;
  if (modo === 'area' && (!area || !AREAS_LISTA.includes(area))) {
    return NextResponse.json({ erro: 'Escolha a área.' }, { status: 400 });
  }

  const idioma = corpo.idioma === 'espanhol' ? 'espanhol' : 'ingles';
  const duracao = MODOS[modo].duracao_min;
  const titulo = tituloTreino(modo, area);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const escolhidas = await sortearQuestoes(client, {
      modo, area, idioma, anoMin: ANO_MIN, anoMax: ANO_MAX,
    });

    const sim = await client.query<{ id: string }>(
      `insert into simulados (titulo, modo, duracao_min, ativo, automatico)
       values ($1, $2, $3, false, true)
       returning id`,
      [titulo, modo, duracao],
    );
    const simId = sim.rows[0].id;

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

    const t = await client.query<{ id: string }>(
      `insert into tentativas (simulado_id, nome, ra, sala, duracao_min)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [simId, dados.nome, dados.ra, dados.sala, duracao],
    );

    await client.query('commit');
    return NextResponse.json({
      tentativa_id: t.rows[0].id,
      questoes: escolhidas.length,
      duracao_min: duracao,
    });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    if (e instanceof ProvaImpossivelError) {
      return NextResponse.json({ erro: e.message }, { status: 400 });
    }
    throw e;
  } finally {
    client.release();
  }
}
