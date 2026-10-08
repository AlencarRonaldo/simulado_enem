import { estaLogado } from '@/lib/auth';
import type { Origem } from '@/lib/metricas';
import { Login } from './Login';
import { Metricas } from './Metricas';
import { Painel } from './Painel';
import { Presencas } from './Presencas';
import { Sair } from './Sair';

export const dynamic = 'force-dynamic';

export default async function Professor({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; sala?: string; semana?: string }>;
}) {
  if (!(await estaLogado())) {
    return (
      <main className="entrada-tela">
        <div className="entrada-grade">
          <header className="marca">
            <p className="marca-rotulo">Acesso restrito</p>
            <h1 className="marca-titulo">Painel do<br />professor</h1>
            <p className="marca-sub">
              Monte simulados, acompanhe quem fez a prova e veja onde a turma travou.
            </p>
          </header>
          <div className="formulario-coluna">
            <Login />
          </div>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const origem: Origem = sp.origem === 'treino' || sp.origem === 'todos' ? sp.origem : 'turma';
  const sala = typeof sp.sala === 'string' ? sp.sala : '';
  // Semana vem como 'YYYY-MM-DD' (segunda-feira), o mesmo que o dropdown manda.
  const semana = typeof sp.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : '';

  return (
    <main className="pagina">
      <header className="prof-cabeca">
        <h1>Painel do professor</h1>
        <Sair />
      </header>

      <Presencas semana={semana} origem={origem} sala={sala} />
      <Metricas filtro={{ origem, sala }} />
      <Painel />
    </main>
  );
}
