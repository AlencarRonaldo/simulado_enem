import {
  presencas, resumoSemana, rotuloSemana, semanaAtual, semanasDisponiveis,
  type FiltroPresencas, type Presenca, type Situacao,
} from '@/lib/presencas';
import type { Origem } from '@/lib/metricas';
import { pct } from '@/lib/enem';

/**
 * Quem fez e quem concluiu na semana.
 *
 * Responde a pergunta de toda segunda-feira: "quem está acompanhando?". O
 * treino livre gera uma prova por aluno por dia, entao sem filtro de semana
 * a lista viraria uma parede — e o que o professor quer e a semana letiva.
 */

const SELOS: Record<Situacao, { texto: string; classe: string }> = {
  concluiu: { texto: 'Concluiu', classe: 'aberto' },
  em_andamento: { texto: 'Em andamento', classe: 'automatico' },
  abandonou: { texto: 'Abandonou', classe: 'fechado' },
};

function resumoPresenca(p: Presenca) {
  if (p.situacao === 'concluiu') {
    return (
      <>
        {p.acertos}/{p.total} <span className="nota">acertos</span>
      </>
    );
  }
  if (p.situacao === 'em_andamento') {
    return (
      <>
        {p.respondidas}/{p.total} <span className="nota">respondidas</span>
      </>
    );
  }
  return (
    <>
      {p.respondidas}/{p.total} <span className="nota">deixou na metade</span>
    </>
  );
}

export async function Presencas({
  semana,
  origem,
  sala,
}: {
  semana: string;
  origem: Origem;
  sala: string;
}) {
  const atual = await semanaAtual();
  const inicio = semana || atual.inicio;
  const filtro: FiltroPresencas = { origem, sala };
  const opcoes = await semanasDisponiveis(filtro);

  // A semana corrente entra mesmo sem dados: "ninguem fez nada esta semana"
  // e a resposta mais importante de todas, e ela nao pode ficar escondida
  // num dropdown so com semanas passadas.
  if (!opcoes.some((o) => o.inicio === inicio)) {
    opcoes.unshift({
      chave: atual.chave,
      inicio: atual.inicio,
      rotulo: `${rotuloSemana(atual.inicio)} (semana atual)`,
      provas: 0,
      concluidas: 0,
    });
  }

  const [r, lista] = await Promise.all([
    resumoSemana(inicio, filtro),
    presencas(inicio, filtro),
  ]);

  return (
    <section className="secao">
      <div className="cabeca-secao">
        <span className="cabeca-numeral">I</span>
        <h2 className="cabeca-titulo">Quem fez esta semana</h2>
        <p className="nota cabeca-nota">
          {rotuloSemana(inicio)}
        </p>
      </div>

      {/* Filtros da MESMA pagina: sem eles, trocar a semana resetaria a origem
          e a sala escolhidas no bloco de metricas. */}
      <form method="get" className="filtros" style={{ marginBottom: '2rem' }}>
        {origem && <input type="hidden" name="origem" value={origem} />}
        {sala && <input type="hidden" name="sala" value={sala} />}
        <label className="campo">
          <span>Semana</span>
          <select name="semana" defaultValue={inicio}>
            {opcoes.map((o) => (
              <option key={o.inicio} value={o.inicio}>
                {o.rotulo}{o.provas > 0 ? ` — ${o.provas} prova${o.provas === 1 ? '' : 's'}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="botao-principal">Ver</button>
      </form>

      {/* Placar da semana: cifras separadas por fio, sem cartao em volta. */}
      <div className="faixa-numeros">
        <span className="faixa-cifra">
          <b className="faixa-valor">{r.alunos}</b>
          <span className="faixa-rotulo">{r.alunos === 1 ? 'aluno' : 'alunos'} nesta semana</span>
        </span>
        <span className="faixa-cifra">
          <b className="faixa-valor">{r.concluidas}</b>
          <span className="faixa-rotulo">concluída{r.concluidas === 1 ? '' : 's'}</span>
        </span>
        <span className="faixa-cifra">
          <b className="faixa-valor">{r.em_andamento}</b>
          <span className="faixa-rotulo">em andamento</span>
        </span>
        <span className="faixa-cifra">
          <b className="faixa-valor">{r.abandonadas}</b>
          <span className="faixa-rotulo">abandonada{r.abandonadas === 1 ? '' : 's'}</span>
        </span>
        <span className="faixa-cifra secundaria">
          <b className="faixa-valor">{pct(r.percentual_medio)}</b>
          <span className="faixa-rotulo">acerto médio</span>
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="cabeca-secao" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--linha)' }}>
          <h3 className="cabeca-titulo">Ninguém fez prova nesta semana</h3>
          <p className="nota cabeca-nota">
            Nenhuma tentativa iniciada entre {rotuloSemana(inicio)}. Se acha que isso
            está errado, vale conferir se os alunos estão entrando pelo endereço certo.
          </p>
        </div>
      ) : (
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Sala</th>
                <th>Prova</th>
                <th className="num">Resultado</th>
                <th>Situação</th>
                <th className="num">Começou</th>
                <th className="num">Terminou</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.tentativa_id}>
                  <td>
                    {p.nome}
                    <br />
                    <span className="nota">RA {p.ra}</span>
                  </td>
                  <td>{p.sala}</td>
                  <td>
                    {p.titulo}
                    {p.automatico && (
                      <>
                        <br />
                        <span className="nota">treino do aluno</span>
                      </>
                    )}
                  </td>
                  <td className="num">{resumoPresenca(p)}</td>
                  <td>
                    <span className={`selo ${SELOS[p.situacao].classe}`}>
                      {SELOS[p.situacao].texto}
                    </span>
                  </td>
                  <td className="num">{p.comecou}</td>
                  <td className="num">{p.terminou ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="nota" style={{ marginTop: '.5rem' }}>
        “Abandonou” é quem começou e deixou o tempo passar sem entregar — a prova
        fecha sozinha, mas o nome continua na lista. Vale um toque na próxima aula.
      </p>
    </section>
  );
}
