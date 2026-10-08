import { q } from '@/lib/db';
import { FormularioEntrada, type SimuladoAberto } from './FormularioEntrada';

export const dynamic = 'force-dynamic';

export default async function Entrada() {
  let simulados: SimuladoAberto[] = [];
  let erroBanco = false;

  try {
    simulados = await q<SimuladoAberto>(
      `select s.id, s.titulo, s.modo, s.duracao_min,
              (select count(*)::int from simulado_questoes sq where sq.simulado_id = s.id) as questoes
         from simulados s
        where s.ativo = true
        order by s.criado_em desc`,
    );
  } catch {
    erroBanco = true;
  }

  return (
    <main className="entrada-tela">
      <div className="entrada-caixa">
        <header className="marca">
          <h1 className="marca-titulo">Simulado ENEM</h1>
          <p className="marca-sub">Questões das provas oficiais de 2015 a 2023.</p>
        </header>

        {erroBanco ? (
          <div className="aviso">
            Não foi possível falar com o banco de dados. Avise o professor.
          </div>
        ) : (
          /* Mesmo formulario com ou sem simulado da turma: se nao houver nenhum
             aberto, sobra o treino livre, que monta a prova na hora. */
          <FormularioEntrada simulados={simulados} />
        )}
      </div>
    </main>
  );
}
