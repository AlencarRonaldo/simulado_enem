/**
 * Conversor de Markdown -> blocos, para o texto das questoes.
 *
 * Os campos de texto do acervo vem em Markdown, nao em texto puro. Medido nas
 * 1.541 questoes de 2015-2023:
 *   - 706 imagens `![](url)` em 580 questoes (38%)
 *   - 1.028 negritos `**x**` em 684 questoes (44%)
 *   - 8 links, 3 titulos, 1 citacao, 1 italico
 * Renderizar isso como texto puro mostra `![](https://enem.dev/...)` no meio do
 * enunciado — o aluno ve lixo e, pior, perde a imagem.
 *
 * NAO e um parser de Markdown completo de proposito: cobre exatamente o que
 * existe no acervo, medido, e nada mais. Qualquer sintaxe fora dessa lista
 * passa como texto literal, que e o comportamento seguro.
 */

const RE_IMAGEM = /!\[[^\]]*\]\(([^)]+)\)/g;
const RE_LINK = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
const RE_FORTE = /\*\*([^*]+)\*\*/g;

/** Quebra um texto em partes, marcando o que esta em **negrito**. */
function partes(texto) {
  const saida = [];
  let fim = 0;
  for (const m of texto.matchAll(RE_FORTE)) {
    if (m.index > fim) saida.push({ texto: texto.slice(fim, m.index), forte: false });
    saida.push({ texto: m[1], forte: true });
    fim = m.index + m[0].length;
  }
  if (fim < texto.length) saida.push({ texto: texto.slice(fim), forte: false });
  return saida.filter((p) => p.texto !== '');
}

/** Limpa marcacoes de linha que nao viram bloco proprio. */
function limparLinhas(texto) {
  return texto
    .replace(RE_LINK, '$1')          // link vira so o texto: numa prova nao se clica
    .replace(/^#{1,6}\s+/gm, '')     // titulo: o estilo ja vem do CSS
    .replace(/^>\s?/gm, '');         // citacao: idem
}

/**
 * Converte um texto Markdown em blocos.
 *
 * @param {string} texto
 * @param {(url: string) => string | null} resolverImagem
 *        recebe a URL do Markdown e devolve o caminho local, ou null se a
 *        imagem nao existir no repositorio.
 * @returns {{blocos: Array, usadas: string[], perdidas: string[]}}
 */
export function paraBlocos(texto, resolverImagem) {
  const blocos = [];
  const usadas = [];
  const perdidas = [];

  if (!texto || !texto.trim()) return { blocos, usadas, perdidas };

  // Separa o texto nos pontos onde ha imagem, preservando a ORDEM: uma imagem
  // no meio do texto de apoio pertence aquele ponto, nao ao fim da questao.
  let fim = 0;
  const pedacos = [];
  for (const m of texto.matchAll(RE_IMAGEM)) {
    pedacos.push({ tipo: 'texto', valor: texto.slice(fim, m.index) });
    pedacos.push({ tipo: 'imagem', valor: m[1] });
    fim = m.index + m[0].length;
  }
  pedacos.push({ tipo: 'texto', valor: texto.slice(fim) });

  for (const p of pedacos) {
    if (p.tipo === 'imagem') {
      const local = resolverImagem(p.valor);
      if (local) { blocos.push({ tipo: 'imagem', src: local }); usadas.push(local); }
      else perdidas.push(p.valor);
      continue;
    }
    const limpo = limparLinhas(p.valor);
    // Paragrafo = separado por linha em branco. Quebra simples de linha fica
    // dentro do paragrafo (poemas e letras de musica dependem disso).
    for (const par of limpo.split(/\n\s*\n/)) {
      const t = par.replace(/^\n+|\n+$/g, '');
      if (t.trim()) blocos.push({ tipo: 'paragrafo', partes: partes(t) });
    }
  }

  return { blocos, usadas, perdidas };
}

/** Texto puro dos blocos — usado no relatorio do professor e em buscas. */
export function paraTextoPuro(blocos) {
  return blocos
    .filter((b) => b.tipo === 'paragrafo')
    .map((b) => b.partes.map((p) => p.texto).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
