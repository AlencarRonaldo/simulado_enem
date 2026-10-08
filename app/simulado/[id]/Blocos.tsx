import type { Bloco } from '@/lib/tentativa';

/**
 * Renderiza os blocos de uma questao.
 *
 * O texto do acervo vem em Markdown e e convertido em blocos na preparacao
 * (scripts/markdown.mjs), nao aqui: converter durante a prova significaria
 * reprocessar 90 questoes no navegador de um celular, a cada carregamento.
 * Aqui so se desenha o que ja veio pronto.
 */
export function Blocos({
  blocos,
  classe,
  alt,
}: {
  blocos: Bloco[];
  classe: string;
  alt: string;
}) {
  if (!blocos?.length) return null;

  return (
    <>
      {blocos.map((b, i) =>
        b.tipo === 'imagem' ? (
          <figure className="figura" key={`${b.src}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={alt} />
          </figure>
        ) : (
          <p className={classe} key={i}>
            {b.partes.map((p, j) =>
              p.forte ? <strong key={j}>{p.texto}</strong> : <span key={j}>{p.texto}</span>,
            )}
          </p>
        ),
      )}
    </>
  );
}
