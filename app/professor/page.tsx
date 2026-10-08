import { estaLogado } from '@/lib/auth';
import type { Origem } from '@/lib/metricas';
import { Login } from './Login';
import { Metricas } from './Metricas';
import { Painel } from './Painel';
import { Sair } from './Sair';

export const dynamic = 'force-dynamic';

export default async function Professor({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; sala?: string }>;
}) {
  if (!(await estaLogado())) {
    return (
      <main className="entrada-tela">
        <div className="entrada-caixa">
          <header className="marca">
            <h1 className="marca-titulo">Painel do professor</h1>
            <p className="marca-sub">Monte simulados e acompanhe as turmas.</p>
          </header>
          <Login />
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const origem: Origem = sp.origem === 'treino' || sp.origem === 'todos' ? sp.origem : 'turma';
  const sala = typeof sp.sala === 'string' ? sp.sala : '';

  return (
    <main className="pagina">
      <header className="prof-cabeca">
        <h1>Painel do professor</h1>
        <Sair />
      </header>

      <Metricas filtro={{ origem, sala }} />
      <Painel />
    </main>
  );
}
