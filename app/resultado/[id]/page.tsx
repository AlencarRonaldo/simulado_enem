import Link from 'next/link';
import { notFound } from 'next/navigation';
import { corrigir, estadoTentativa } from '@/lib/tentativa';
import { nomeArea, pct } from '@/lib/enem';

export const dynamic = 'force-dynamic';

export default async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const t = await estadoTentativa(id);
  if (!t) notFound();

  // Enquanto a prova está aberta, o resultado não aparece — senão bastaria
  // abrir esta página em outra aba para ver o gabarito durante o simulado.
  if (!t.finalizado_em) {
    return (
      <main className="pagina">
        <div className="folha-papel cartao">
          <h1>Simulado em andamento</h1>
          <p>O resultado aparece quando você entregar ou o tempo acabar.</p>
          <Link className="botao botao-principal" href={`/simulado/${id}`}>
            Voltar para a prova
          </Link>
        </div>
      </main>
    );
  }

  const c = await corrigir(id);
  const minutos = Math.round(
    (new Date(t.finalizado_em).getTime() - new Date(t.iniciado_em).getTime()) / 60000,
  );

  return (
    <main className="pagina">
      <header className="prof-cabeca">
        <div>
          <h1>Resultado</h1>
          <p className="nota" style={{ margin: 0 }}>
            {t.nome} · RA {t.ra} · sala {t.sala} — {t.titulo}
          </p>
        </div>
      </header>

      <section className="folha-papel placar">
        <span className="placar-numero">{c.acertos}</span>
        <span className="placar-de">de {c.total} acertos</span>
        <span className="placar-pct">{pct(c.percentual)}</span>
      </section>

      <p className="nota" style={{ marginTop: '-.5rem', marginBottom: '2rem' }}>
        {c.respondidas < c.total
          ? `Você respondeu ${c.respondidas} questões e deixou ${c.total - c.respondidas} em branco. `
          : 'Você respondeu todas as questões. '}
        Levou {minutos} min de {t.duracao_min} min. Este número é de acertos brutos: a nota
        oficial do ENEM usa TRI, que pesa cada questão pela dificuldade e não pode ser
        reproduzida aqui.
      </p>

      <section className="secao">
        <h2 className="secao-titulo">Por área</h2>
        <div className="folha-papel" style={{ padding: '.25rem .75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Área</th>
                <th className="num">Acertos</th>
                <th style={{ width: '35%' }}>&nbsp;</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {c.por_area.map((a) => (
                <tr key={a.area}>
                  <td>{nomeArea(a.area).split(' e suas')[0]}</td>
                  <td className="num">{a.acertos}/{a.total}</td>
                  <td>
                    <span className="barra-prop">
                      <i style={{ width: `${a.percentual}%` }} />
                    </span>
                  </td>
                  <td className="num">{pct(a.percentual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="secao">
        <h2 className="secao-titulo">Gabarito questão por questão</h2>
        <div className="folha-papel tabela-rolagem" style={{ padding: '.25rem .75rem' }}>
          <table>
            <thead>
              <tr>
                <th className="num">Nº</th>
                <th>Área</th>
                <th>Prova</th>
                <th>Você marcou</th>
                <th>Resposta</th>
              </tr>
            </thead>
            <tbody>
              {c.itens.map((it) => (
                <tr key={it.questao_id}>
                  <td className="num">{it.ordem}</td>
                  <td>{nomeArea(it.area).split(' e suas')[0]}</td>
                  <td className="nota">ENEM {it.ano}, q. {it.numero}</td>
                  <td className={it.marcada === null ? 'vazio' : it.acertou ? 'certo' : 'errado'}>
                    {it.marcada ?? 'em branco'}
                  </td>
                  <td>{it.gabarito}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link className="botao" href="/">Voltar ao início</Link>
    </main>
  );
}
