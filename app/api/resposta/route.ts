import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { estadoTentativa, podeResponder } from '@/lib/tentativa';

export const dynamic = 'force-dynamic';

/**
 * POST /api/resposta  { tentativa_id, questao_id, letra }
 *
 * O AUTOSAVE. Chamado a cada clique em alternativa — nao existe botao "salvar".
 * Internet de escola cai no meio da prova; se as respostas so fossem enviadas
 * no "finalizar", o aluno perderia tudo.
 *
 * Trocar de alternativa sobrescreve (upsert). Mandar a mesma letra de novo
 * nao muda nada e nao da erro, porque o cliente pode reenviar depois de uma
 * falha de rede.
 */
export async function POST(req: Request) {
  let corpo: Record<string, string>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const tentativa_id = String(corpo.tentativa_id || '');
  const questao_id = String(corpo.questao_id || '');
  const letra = String(corpo.letra || '').toUpperCase();

  if (!/^[0-9a-f-]{36}$/i.test(tentativa_id)) {
    return NextResponse.json({ erro: 'Tentativa inválida.' }, { status: 400 });
  }
  if (!['A', 'B', 'C', 'D', 'E'].includes(letra)) {
    return NextResponse.json({ erro: 'Alternativa inválida.' }, { status: 400 });
  }

  const t = await estadoTentativa(tentativa_id);
  if (!t) return NextResponse.json({ erro: 'Tentativa não encontrada.' }, { status: 404 });

  if (!podeResponder(t)) {
    return NextResponse.json(
      { erro: 'O tempo acabou. Suas respostas já foram salvas.', finalizada: true },
      { status: 409 },
    );
  }

  // A questao tem de pertencer ao simulado desta tentativa. Sem esta checagem,
  // daria para responder questao de outro simulado mexendo no payload.
  const pertence = await q<{ ok: number }>(
    `select 1 as ok
       from simulado_questoes
      where simulado_id = $1 and questao_id = $2`,
    [t.simulado_id, questao_id],
  );
  if (pertence.length === 0) {
    return NextResponse.json({ erro: 'Questão não pertence a este simulado.' }, { status: 400 });
  }

  await q(
    `insert into respostas (tentativa_id, questao_id, letra)
     values ($1, $2, $3)
     on conflict (tentativa_id, questao_id)
       do update set letra = excluded.letra, respondido_em = now()`,
    [tentativa_id, questao_id, letra],
  );

  return NextResponse.json({ ok: true, restante_s: t.restante_s });
}
