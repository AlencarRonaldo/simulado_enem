import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { estaLogado } from '@/lib/auth';
import { relatorioCompleto } from '@/lib/relatorio';
import { nomeArea, pct } from '@/lib/enem';

export const dynamic = 'force-dynamic';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

export default async function PaginaRelatorio({ params }: { params: Promise<{ id: string }> }) {
  if (!(await estaLogado())) redirect('/professor');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const r = await relatorioCompleto(id);
  if (!r) notFound();

  const { simulado, alunos, por_area, por_sala, questoes } = r;
  const concluidos = alunos.filter((a) => a.finalizado_em).length;
  const maisErradas = questoes.filter((qq) => qq.respostas > 0).slice(0, 15);

  return (
    <main className="pagina">
      <header className="prof-cabeca">
        <div style={{ flex: 1 }}>
          <h1>{simulado.titulo}</h1>
          <p className="prof-sub">
            {simulado.questoes} questões · {simulado.duracao_min} min
          </p>
        </div>
        <a className="botao" href={`/api/professor/csv/${id}`}>Baixar notas (CSV)</a>
        <Link className="botao" href="/professor">Voltar</Link>
      </header>

      {alunos.length === 0 ? (
        <div className="cabeca-secao" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--linha)' }}>
          <h2 className="cabeca-titulo">Ninguém fez este simulado ainda</h2>
          <p className="nota cabeca-nota">
            Os resultados aparecem aqui conforme os alunos respondem — não precisa
            esperar todos terminarem.
          </p>
        </div>
      ) : (
        <>
          {/* Placar da turma: cifras separadas por fio, sem cartao em volta. */}
          <div className="faixa-numeros">
            <span className="faixa-cifra">
              <b className="faixa-valor">{alunos.length}</b>
              <span className="faixa-rotulo">{alunos.length === 1 ? 'aluno' : 'alunos'}</span>
            </span>
            <span className="faixa-cifra">
              <b className="faixa-valor">{concluidos}</b>
              <span className="faixa-rotulo">concluíram</span>
            </span>
            <span className="faixa-cifra">
              <b className="faixa-valor">
                {pct(alunos.reduce((s, a) => s + (a.percentual ?? 0), 0) / alunos.length)}
              </b>
              <span className="faixa-rotulo">média de acerto</span>
            </span>
          </div>

          {/* -------------------------------------------------- por area */}
          <section className="secao">
            <div className="cabeca-secao">
              <span className="cabeca-numeral">I</span>
              <h2 className="cabeca-titulo">Acerto da turma por área</h2>
              <p className="nota cabeca-nota">
                Percentual calculado sobre as questões respondidas, não sobre o total —
                questão em branco não conta como erro aqui.
              </p>
            </div>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Área</th>
                    <th className="num">Questões</th>
                    <th className="num">Respostas</th>
                    <th style={{ width: '30%' }}>&nbsp;</th>
                    <th className="num">Acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {por_area.map((a) => (
                    <tr key={a.area}>
                      <td>{nomeArea(a.area).split(' e suas')[0]}</td>
                      <td className="num">{a.questoes}</td>
                      <td className="num">{a.respondidas}</td>
                      <td>
                        <span className="barra-prop">
                          <i style={{ width: `${a.percentual_das_respondidas ?? 0}%` }} />
                        </span>
                      </td>
                      <td className="num">{pct(a.percentual_das_respondidas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* --------------------------------------------------- por sala */}
          {por_sala.length > 1 && (
            <section className="secao">
              <div className="cabeca-secao">
                <span className="cabeca-numeral">II</span>
                <h2 className="cabeca-titulo">Por sala</h2>
              </div>
              <div className="tabela-rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>Sala</th>
                      <th className="num">Alunos</th>
                      <th style={{ width: '40%' }}>&nbsp;</th>
                      <th className="num">Média de acerto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {por_sala.map((s) => (
                      <tr key={s.sala}>
                        <td>{s.sala}</td>
                        <td className="num">{s.alunos}</td>
                        <td>
                          <span className="barra-prop">
                            <i style={{ width: `${s.percentual_medio ?? 0}%` }} />
                          </span>
                        </td>
                        <td className="num">{pct(s.percentual_medio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ------------------------------------------- questoes erradas */}
          <section className="secao">
            <div className="cabeca-secao">
              <span className="cabeca-numeral">III</span>
              <h2 className="cabeca-titulo">Questões que a turma mais errou</h2>
              <p className="nota cabeca-nota">
                Em verde o gabarito, em vermelho a alternativa que a turma escolheu mais.
                Quando as duas não coincidem, a turma inteira errou do mesmo jeito — é aí
                que vale voltar o conteúdo.
              </p>
            </div>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th className="num">Nº</th>
                    <th>Questão</th>
                    <th className="num">Acerto</th>
                    <th>Como marcaram</th>
                  </tr>
                </thead>
                <tbody>
                  {maisErradas.map((qq) => {
                    const maisMarcada = LETRAS.reduce(
                      (acc, l) => ((qq.distribuicao[l] ?? 0) > (qq.distribuicao[acc] ?? 0) ? l : acc),
                      'A' as (typeof LETRAS)[number],
                    );
                    return (
                      <tr key={qq.questao_id}>
                        <td className="num">{qq.ordem}</td>
                        <td>
                          <span className="nota">
                            {nomeArea(qq.area).split(' e suas')[0]} · ENEM {qq.ano}, q. {qq.numero}
                          </span>
                          <br />
                          {qq.trecho}…
                        </td>
                        <td className="num">
                          {pct(qq.percentual)}
                          <br />
                          <span className="nota">{qq.acertos}/{qq.respostas}</span>
                        </td>
                        <td>
                          {LETRAS.map((l) => {
                            const n = qq.distribuicao[l] ?? 0;
                            const certa = l === qq.gabarito;
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------- por aluno */}
          <section className="secao">
            <div className="cabeca-secao">
              <span className="cabeca-numeral">IV</span>
              <h2 className="cabeca-titulo">Alunos</h2>
            </div>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>RA</th>
                    <th>Sala</th>
                    <th className="num">Acertos</th>
                    <th className="num">%</th>
                    <th className="num">Em branco</th>
                    <th className="num">Tempo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((a) => (
                    <tr key={a.id}>
                      <td>{a.nome}</td>
                      <td>{a.ra}</td>
                      <td>{a.sala}</td>
                      <td className="num">{a.acertos}/{a.total}</td>
                      <td className="num">{pct(a.percentual)}</td>
                      <td className="num">{a.total - a.respondidas}</td>
                      <td className="num">{a.minutos_gastos === null ? '—' : `${a.minutos_gastos} min`}</td>
                      <td>
                        {a.finalizado_em
                          ? <Link href={`/resultado/${a.id}`}>Ver prova</Link>
                          : <span className="nota">fazendo agora</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
