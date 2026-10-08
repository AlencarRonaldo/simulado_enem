import {
  MIN_RESPOSTAS, maisAcertadas, maisErradas, porArea, porSala,
  resumo, salasDisponiveis, type FiltroMetricas, type QuestaoMetrica,
} from '@/lib/metricas';
import { nomeArea, pct } from '@/lib/enem';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

function areaCurta(a: string) {
  return nomeArea(a).split(' e suas')[0];
}

/** Como a turma se distribuiu pelas alternativas — gabarito em verde. */
function Distribuicao({ q }: { q: QuestaoMetrica }) {
  const maisMarcada = LETRAS.reduce(
    (acc, l) => ((q.distribuicao[l] ?? 0) > (q.distribuicao[acc] ?? 0) ? l : acc),
    'A' as (typeof LETRAS)[number],
  );
  return (
    <>
      {LETRAS.map((l) => {
        const n = q.distribuicao[l] ?? 0;
        const certa = l === q.gabarito;
        return (
          <span
            key={l}
            className={certa ? 'certo' : l === maisMarcada && n > 0 ? 'errado' : 'vazio'}
            style={{ marginRight: '.625rem', whiteSpace: 'nowrap', fontSize: '.8125rem' }}
            title={certa ? 'Resposta correta' : undefined}
          >
            {l} {n}
          </span>
        );
      })}
    </>
  );
}

function TabelaQuestoes({ questoes }: { questoes: QuestaoMetrica[] }) {
  /* Sem moldura: a tabela e impressa direto na pagina, separada por fios.
     A cabeca-secao que a antede ja disse onde ela comeca. */
  return (
    <div className="tabela-rolagem">
      <table>
        <thead>
          <tr>
            <th>Questão</th>
            <th className="num">Acerto</th>
            <th>Como marcaram</th>
          </tr>
        </thead>
        <tbody>
          {questoes.map((qq) => (
            <tr key={qq.questao_id}>
              <td>
                <span className="nota">
                  {areaCurta(qq.area)} · ENEM {qq.ano}, q. {qq.numero}
                </span>
                <br />
                {qq.trecho}…
              </td>
              <td className="num">
                {pct(qq.percentual)}
                <br />
                <span className="nota">{qq.acertos}/{qq.respostas}</span>
              </td>
              <td><Distribuicao q={qq} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Visao geral de revisao, no painel do professor.
 * Filtros num form GET: sem JavaScript, funciona ate com o painel aberto
 * numa maquina lenta da escola.
 */
export async function Metricas({ filtro }: { filtro: FiltroMetricas }) {
  const [r, areas, salas, erradas, acertadas, opcoes] = await Promise.all([
    resumo(filtro),
    porArea(filtro),
    porSala(filtro),
    maisErradas(filtro),
    maisAcertadas(filtro),
    salasDisponiveis(filtro),
  ]);

  const temDados = r.respostas > 0;

  return (
    <section className="secao">
      <div className="cabeca-secao">
        <span className="cabeca-numeral">II</span>
        <h2 className="cabeca-titulo">Como está a turma</h2>
        <p className="nota cabeca-nota">
          Acertos por área, por sala e as questões que mais derrubaram a turma.
        </p>
      </div>

      {/* Filtros no topo da secao: em form GET, sem JavaScript — funciona ate
          com o painel aberto numa maquina lenta da escola. */}
      <form method="get" className="filtros" style={{ marginBottom: '2rem' }}>
        <label className="campo">
          <span>Ver</span>
          <select name="origem" defaultValue={filtro.origem}>
            <option value="turma">Simulados da turma</option>
            <option value="treino">Treinos dos alunos</option>
            <option value="todos">Tudo junto</option>
          </select>
        </label>
        <label className="campo">
          <span>Sala</span>
          <select name="sala" defaultValue={filtro.sala}>
            <option value="">Todas</option>
            {opcoes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="botao-principal">Aplicar</button>
      </form>

      {!temDados ? (
        <div className="cabeca-secao" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--linha)' }}>
          <h3 className="cabeca-titulo">Ainda não há respostas para mostrar</h3>
          <p className="nota cabeca-nota">
            Assim que os alunos começarem a responder, os acertos e erros aparecem
            aqui — {filtro.origem === 'treino' ? 'talvez outro filtro tenha dados' : 'não precisa esperar todos terminarem'}.
          </p>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------ placar */}
          {/* Uma linha de cifras separadas por fio, sem cartao em volta —
              boletim, nao dashboard. */}
          <div className="faixa-numeros">
            <span className="faixa-cifra">
              <b className="faixa-valor">{r.alunos}</b>
              <span className="faixa-rotulo">{r.alunos === 1 ? 'aluno' : 'alunos'}</span>
            </span>
            <span className="faixa-cifra">
              <b className="faixa-valor">{r.tentativas}</b>
              <span className="faixa-rotulo">
                {r.tentativas === 1 ? 'prova feita' : 'provas feitas'}
                {r.concluidas > 0 && ` · ${r.concluidas} concluída${r.concluidas === 1 ? '' : 's'}`}
              </span>
            </span>
            <span className="faixa-cifra">
              <b className="faixa-valor">{pct(r.percentual)}</b>
              <span className="faixa-rotulo">acerto médio em {r.respostas} respostas</span>
            </span>
          </div>

          {/* ---------------------------------------------------- por area */}
          <section className="secao">
            <div className="cabeca-secao cabeca-subsecao">
              <h2 className="cabeca-titulo">Onde estão os buracos</h2>
              <p className="nota cabeca-nota">Por área do conhecimento, pior primeiro.</p>
            </div>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Área</th>
                    <th className="num">Respostas</th>
                    <th style={{ width: '40%' }}>&nbsp;</th>
                    <th className="num">Acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.area}>
                      <td>{areaCurta(a.area)}</td>
                      <td className="num">{a.respostas}</td>
                      <td>
                        <span className="barra-prop">
                          <i style={{ width: `${a.percentual ?? 0}%` }} />
                        </span>
                      </td>
                      <td className="num">{pct(a.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* -------------------------------------------------- por sala */}
          {salas.length > 1 && (
            <section className="secao">
              <div className="cabeca-secao cabeca-subsecao">
                <h2 className="cabeca-titulo">Por sala</h2>
                <p className="nota cabeca-nota">Pior primeiro.</p>
              </div>
              <div className="tabela-rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>Sala</th>
                      <th className="num">Provas</th>
                      <th style={{ width: '40%' }}>&nbsp;</th>
                      <th className="num">Acerto médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salas.map((s) => (
                      <tr key={s.sala}>
                        <td>{s.sala}</td>
                        <td className="num">{s.tentativas}</td>
                        <td>
                          <span className="barra-prop">
                            <i style={{ width: `${s.percentual ?? 0}%` }} />
                          </span>
                        </td>
                        <td className="num">{pct(s.percentual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ------------------------------------------------ erradas */}
          <section className="secao">
            <div className="cabeca-secao cabeca-subsecao">
              <h2 className="cabeca-titulo">O que a turma mais errou</h2>
              <p className="nota cabeca-nota">
                Candidate à revisão. Em verde o gabarito, em vermelho a alternativa
                mais escolhida — quando as duas não coincidem, a turma inteira errou
                do mesmo jeito, e é aí que a aula precisa voltar. Só entram questões
                com {MIN_RESPOSTAS} respostas ou mais.
              </p>
            </div>
            {erradas.length === 0 ? (
              <p className="nota">Nenhuma questão chegou a {MIN_RESPOSTAS} respostas ainda.</p>
            ) : (
              <TabelaQuestoes questoes={erradas} />
            )}
          </section>

          {/* ----------------------------------------------- acertadas */}
          {acertadas.length > 0 && (
            <section className="secao">
              <div className="cabeca-secao cabeca-subsecao">
                <h2 className="cabeca-titulo">O que já está assentado</h2>
              </div>
              <TabelaQuestoes questoes={acertadas} />
            </section>
          )}
        </>
      )}
    </section>
  );
}
