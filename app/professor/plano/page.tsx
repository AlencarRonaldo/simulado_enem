import Link from 'next/link';
import { redirect } from 'next/navigation';
import { estaLogado } from '@/lib/auth';
import { AREAS_LISTA, nomeArea } from '@/lib/enem';
import {
  MIN_RESPOSTAS, erradasPorArea, salasDisponiveis,
  type FiltroMetricas, type Origem,
} from '@/lib/metricas';
import { ItemQuestao } from './QuestaoPlano';

export const dynamic = 'force-dynamic';

const ROMANOS = ['I', 'II', 'III', 'IV'] as const;

function areaCurta(a: string) {
  return nomeArea(a).split(' e suas')[0];
}

/**
 * Plano de aula por disciplina: as questoes que mais derrubaram a turma em
 * CADA area do conhecimento, com o enunciado expansivel. O professor de
 * cada disciplina abre so a secao dele e sai daqui com o material para a
 * proxima aula. Mesmos filtros das metricas — form GET, sem JavaScript.
 */
export default async function PaginaPlano({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; sala?: string }>;
}) {
  if (!(await estaLogado())) redirect('/professor');

  const sp = await searchParams;
  const origem: Origem = sp.origem === 'treino' || sp.origem === 'todos' ? sp.origem : 'turma';
  const sala = typeof sp.sala === 'string' ? sp.sala : '';

  const filtro: FiltroMetricas = { origem, sala };
  const [questoes, opcoes] = await Promise.all([
    erradasPorArea(filtro),
    salasDisponiveis(filtro),
  ]);

  const temDados = questoes.length > 0;

  return (
    <main className="pagina">
      <header className="prof-cabeca">
        <div style={{ flex: 1 }}>
          <h1>Plano de aula por área</h1>
          <p className="prof-sub">
            As questões que mais derrubaram a turma, separadas por disciplina.
            Abra a questão para ver o enunciado e o gabarito.
          </p>
        </div>
        <Link className="botao" href="/professor">Voltar</Link>
      </header>

      <form method="get" className="filtros" style={{ marginBottom: '2rem' }}>
        <label className="campo">
          <span>Ver</span>
          <select name="origem" defaultValue={origem}>
            <option value="turma">Simulados da turma</option>
            <option value="treino">Treinos dos alunos</option>
            <option value="todos">Tudo junto</option>
          </select>
        </label>
        <label className="campo">
          <span>Sala</span>
          <select name="sala" defaultValue={sala}>
            <option value="">Todas</option>
            {opcoes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="botao-principal">Aplicar</button>
      </form>

      {!temDados ? (
        <div
          className="cabeca-secao"
          style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--linha)' }}
        >
          <h2 className="cabeca-titulo">Ainda não há respostas para mostrar</h2>
          <p className="nota cabeca-nota">
            Assim que os alunos começarem a responder, as questões mais erradas
            de cada área aparecem aqui — {origem === 'treino'
              ? 'talvez outro filtro tenha dados'
              : 'não precisa esperar todos terminarem'}.
          </p>
        </div>
      ) : (
        AREAS_LISTA.map((area, i) => {
          const daArea = questoes.filter((qq) => qq.area === area);
          return (
            <section className="secao" key={area}>
              <div className="cabeca-secao">
                <span className="cabeca-numeral">{ROMANOS[i]}</span>
                <h2 className="cabeca-titulo">{areaCurta(area)}</h2>
                <p className="nota cabeca-nota">
                  As {daArea.length} questões que mais derrubaram esta área —
                  candidate à revisão. Em verde o gabarito, em vermelho a
                  alternativa mais escolhida: quando as duas não coincidem, a
                  turma inteira errou do mesmo jeito. Só entram questões com{' '}
                  {MIN_RESPOSTAS} respostas ou mais.
                </p>
              </div>
              {daArea.length === 0 ? (
                <p className="nota">
                  Nenhuma questão desta área chegou a {MIN_RESPOSTAS} respostas ainda.
                </p>
              ) : (
                <div className="plano-lista">
                  {daArea.map((qq) => (
                    <ItemQuestao key={qq.questao_id} q={qq} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
