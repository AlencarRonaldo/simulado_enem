import { NextResponse } from 'next/server';
import { q, q1 } from '@/lib/db';
import { estaLogado } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Escapa um campo para CSV. */
function c(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/professor/csv/:id — notas da turma em CSV.
 *
 * Separador ";" e BOM UTF-8 porque o destino provavel e o Excel em portugues,
 * que abre "," como uma coluna so e troca acento por caractere estranho sem BOM.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await estaLogado())) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
  }

  const sim = await q1<{ titulo: string }>(`select titulo from simulados where id = $1`, [id]);
  if (!sim) return NextResponse.json({ erro: 'Simulado não encontrado.' }, { status: 404 });

  // Acertos por aluno E por area, em colunas.
  const rows = await q<Record<string, unknown>>(
    `select t.nome, t.ra, t.sala,
            to_char(t.iniciado_em   at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as inicio,
            to_char(t.finalizado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as fim,
            case when t.finalizado_em is null then 'EM ANDAMENTO' else 'CONCLUIDO' end as situacao,
            count(sq.questao_id)::int                        as total,
            count(r.letra)::int                               as respondidas,
            count(*) filter (where r.letra = qu.gabarito)::int as acertos,
            count(*) filter (where r.letra = qu.gabarito and qu.area = 'linguagens')::int        as ac_linguagens,
            count(*) filter (where r.letra = qu.gabarito and qu.area = 'ciencias-humanas')::int  as ac_humanas,
            count(*) filter (where r.letra = qu.gabarito and qu.area = 'ciencias-natureza')::int as ac_natureza,
            count(*) filter (where r.letra = qu.gabarito and qu.area = 'matematica')::int        as ac_matematica
       from tentativas t
       join simulado_questoes sq on sq.simulado_id = t.simulado_id
       join questoes qu          on qu.id = sq.questao_id
       left join respostas r     on r.tentativa_id = t.id and r.questao_id = qu.id
      where t.simulado_id = $1
      group by t.id
      order by acertos desc`,
    [id],
  );

  const cab = [
    'Nome', 'RA', 'Sala', 'Inicio', 'Fim', 'Situacao',
    'Acertos', 'Respondidas', 'Total', 'Percentual',
    'Ac_Linguagens', 'Ac_Humanas', 'Ac_Natureza', 'Ac_Matematica',
  ];

  const linhas = rows.map((r) => {
    const total = Number(r.total) || 0;
    const acertos = Number(r.acertos) || 0;
    const pct = total ? (acertos / total) * 100 : 0;
    return [
      r.nome, r.ra, r.sala, r.inicio, r.fim, r.situacao,
      acertos, r.respondidas, total,
      pct.toFixed(1).replace('.', ','), // virgula decimal: Excel pt-BR
      r.ac_linguagens, r.ac_humanas, r.ac_natureza, r.ac_matematica,
    ].map(c).join(';');
  });

  const csv = '﻿' + [cab.join(';'), ...linhas].join('\r\n');
  const nome = sim.titulo.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_') || 'simulado';

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="notas_${nome}.csv"`,
    },
  });
}
