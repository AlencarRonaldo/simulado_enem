import { redirect, notFound } from 'next/navigation';
import { estadoTentativa, questoesDoSimulado, respostasDaTentativa } from '@/lib/tentativa';
import { Prova } from './Prova';

export const dynamic = 'force-dynamic';

export default async function PaginaSimulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const t = await estadoTentativa(id);
  if (!t) notFound();

  // Acabou (entregue ou tempo esgotado): nao tem como voltar para a prova.
  if (t.finalizado_em) redirect(`/resultado/${id}`);

  const [questoes, respostas] = await Promise.all([
    questoesDoSimulado(t.simulado_id),
    respostasDaTentativa(id),
  ]);

  return (
    <Prova
      tentativaId={id}
      titulo={t.titulo}
      nome={t.nome}
      restanteInicial={t.restante_s}
      questoes={questoes}
      respostasIniciais={respostas}
    />
  );
}
