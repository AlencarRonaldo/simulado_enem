import { q } from '@/lib/db';
import { AvisoInicial } from './AvisoInicial';
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
      <AvisoInicial />
      <div className="entrada-grade">
        {/* Manchete do caderno: o titulo e a capa, nao um cabecalho de app. */}
        <header className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="marca-logo"
            src="/brasao-ayrton-senna.png"
            alt="Brasão da Escola Estadual Ayrton Senna"
          />
          <p className="marca-rotulo">Prova oficial · INEP</p>
          <h1 className="marca-titulo">Simulado<br />ENEM</h1>
          <p className="marca-sub">
            Questões das provas oficiais de 2015 a 2023, com o mesmo formato
            e o mesmo tempo do dia da prova.
          </p>
          <div className="marca-expediente">
            <span>2015 — 2023</span>
            <span>1541 questões</span>
            <span>4 áreas</span>
          </div>
        </header>

        <div className="formulario-coluna">
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
      </div>
    </main>
  );
}
