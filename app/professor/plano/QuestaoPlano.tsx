import { Blocos } from '@/app/simulado/[id]/Blocos';
import { pct } from '@/lib/enem';
import type { QuestaoPlano } from '@/lib/metricas';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Como a turma se distribuiu pelas alternativas — gabarito em verde. */
function Distribuicao({ q }: { q: QuestaoPlano }) {
  const maisMarcada = LETRAS.reduce(
    (acc, l) => ((q.distribuicao[l] ?? 0) > (q.distribuicao[acc] ?? 0) ? l : acc),
    'A' as (typeof LETRAS)[number],
  );
  return (
    <span className="questao-dist">
      {LETRAS.map((l) => {
        const n = q.distribuicao[l] ?? 0;
        const certa = l === q.gabarito;
        return (
          <span
            key={l}
            className={certa ? 'certo' : l === maisMarcada && n > 0 ? 'errado' : 'vazio'}
            title={certa ? 'Resposta correta' : undefined}
          >
            {l} {n}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Uma questao do plano de aula: fechada, so a metrica; aberta, o enunciado
 * inteiro com o gabarito destacado — para o professor planejar a revisao sem
 * procurar a questao fora do sistema. Details/summary e HTML nativo: funciona
 * sem JavaScript, como o resto do painel.
 */
export function ItemQuestao({ q }: { q: QuestaoPlano }) {
  return (
    <details className="questao-plano">
      <summary className="questao-resumo">
        <span className="nota">
          ENEM {q.ano}, q. {q.numero}
          {q.idioma ? ` · ${q.idioma === 'ingles' ? 'Inglês' : 'Espanhol'}` : ''}
        </span>
        <span className="questao-trecho">{q.resumo_completo}</span>
        <span className="questao-num">
          {pct(q.percentual)}
          <br />
          <span className="nota">{q.acertos}/{q.respostas}</span>
        </span>
        <Distribuicao q={q} />
      </summary>

      <div className="questao-corpo">
        <Blocos
          blocos={q.conteudo}
          classe="contexto"
          alt={`Imagem da questão ${q.numero} do ENEM ${q.ano}`}
        />

        {q.imagens_extra?.map((src) => (
          <figure className="figura" key={src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Imagem da questão ${q.numero} do ENEM ${q.ano}`} />
          </figure>
        ))}

        <Blocos
          blocos={q.enunciado}
          classe="pergunta"
          alt={`Imagem do enunciado da questão ${q.numero}`}
        />

        <ul className="alternativas">
          {q.alternativas.map((a) => {
            const certa = a.letra === q.gabarito;
            return (
              <li key={a.letra}>
                <span
                  className={`plano-alternativa${certa ? ' certa' : ''}`}
                  title={certa ? 'Resposta correta' : undefined}
                >
                  <span className="bolha" aria-hidden="true">{a.letra}</span>
                  <span className="alternativa-texto">
                    <span className="sr">Alternativa {a.letra}. </span>
                    <Blocos
                      blocos={a.blocos}
                      classe="alternativa-par"
                      alt={`Alternativa ${a.letra}`}
                    />
                    {a.imagem && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.imagem} alt={`Alternativa ${a.letra}`} />
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
