#!/usr/bin/env node
/**
 * Prepara o banco de questoes local a partir do repositorio aberto enem-api.
 *
 *   node scripts/preparar-questoes.mjs
 *
 * O que faz:
 *   1. Clona (ou reaproveita) github.com/yunger7/enem-api em .cache-enem-api/
 *   2. Le as provas de ANO_INICIAL..ANO_FINAL
 *   3. DESCARTA questoes defeituosas (ver regras em `defeitos()`)
 *   4. Copia as imagens para public/q/<ano>/<numero>/ e reescreve os caminhos
 *   5. Grava data/questoes.json
 *
 * Nada aqui invoca rede alem do git clone. Rode de novo quando quiser atualizar.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paraBlocos, paraTextoPuro } from './markdown.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(RAIZ, '.cache-enem-api');
const REPO = 'https://github.com/yunger7/enem-api.git';
const ANO_INICIAL = 2015;
const ANO_FINAL = 2023;

const AREAS = new Set(['linguagens', 'ciencias-humanas', 'ciencias-natureza', 'matematica']);

function log(...a) { console.log(...a); }

// ----------------------------------------------------------------- 1. clone
function obterRepo() {
  if (fs.existsSync(path.join(CACHE, 'public', 'exams.json'))) {
    log('> Repositorio ja em cache em .cache-enem-api (apague a pasta para baixar de novo)');
    return;
  }
  fs.rmSync(CACHE, { recursive: true, force: true });
  log(`> Clonando ${REPO} (~110 MB, pode levar alguns minutos)...`);
  execFileSync('git', ['clone', '--depth', '1', REPO, CACHE], { stdio: 'inherit' });
}

// ------------------------------------------------- 2. regras de descarte
/**
 * Devolve a lista de defeitos de uma questao. Lista vazia = questao usavel.
 *
 * Estes defeitos vem da raspagem original dos PDFs do INEP, nao do nosso codigo.
 * Medido em 2015-2023: 113 de 1.654 questoes (6,8%) caem aqui.
 */
function defeitos(q) {
  const d = [];
  const alts = Array.isArray(q.alternatives) ? q.alternatives : [];
  const temContexto = typeof q.context === 'string' && q.context.trim() !== '';
  const temImagemEnunciado = Array.isArray(q.files) && q.files.length > 0;

  // Sem texto de apoio E sem imagem: a pergunta fica solta e sem sentido.
  if (!temContexto && !temImagemEnunciado) d.push('sem enunciado');

  // ENEM tem sempre 5 alternativas (A-E).
  if (alts.length !== 5) d.push(`alternativas=${alts.length}`);

  // Alternativa sem texto e sem imagem: impossivel de responder.
  if (alts.some((a) => !(a.text || '').trim() && !a.file)) d.push('alternativa vazia');

  if (!q.correctAlternative) d.push('sem gabarito');
  if (!AREAS.has(q.discipline)) d.push(`area desconhecida: ${q.discipline}`);

  return d;
}

// ------------------------------------------------------ 3. imagens
/** Converte 'https://enem.dev/2015/questions/1/abc.jpg' no caminho relativo do repo. */
function caminhoNoRepo(url) {
  return String(url).replace(/^https?:\/\/[^/]+\//, '');
}

function copiarImagem(url, ano, slug, destinos) {
  const rel = caminhoNoRepo(url);
  const origem = path.join(CACHE, 'public', rel);
  if (!fs.existsSync(origem)) return null; // imagem faltando: sinalizada pelo chamador

  const arquivo = path.basename(rel);
  const pastaDestino = path.join(RAIZ, 'public', 'q', String(ano), slug);
  fs.mkdirSync(pastaDestino, { recursive: true });
  const destino = path.join(pastaDestino, arquivo);
  if (!fs.existsSync(destino)) fs.copyFileSync(origem, destino);
  destinos.push(destino);
  return `/q/${ano}/${slug}/${arquivo}`;
}

// --------------------------------------------------------------- 4. main
function main() {
  obterRepo();

  const questoes = [];
  const descartadas = [];
  const imagensFaltando = [];
  const copiadas = [];
  const porArea = {};
  const porAno = {};

  for (let ano = ANO_INICIAL; ano <= ANO_FINAL; ano++) {
    const pastaAno = path.join(CACHE, 'public', String(ano), 'questions');
    if (!fs.existsSync(pastaAno)) {
      log(`! ${ano}: pasta nao encontrada no repositorio, pulando`);
      continue;
    }

    // ATENCAO: as pastas NAO sao todas numericas. As questoes de lingua
    // estrangeira vem como "91-espanhol" e "91-ingles" — duas questoes
    // diferentes com o MESMO numero 91, porque na prova real o aluno faz so
    // uma das duas. Por isso o identificador usa o nome da pasta (o slug),
    // nao o numero: usar o numero faria as duas colidirem em "2015-91" e
    // converter a pasta com Number() descartaria silenciosamente as 85
    // questoes de idioma do acervo.
    const pastas = fs.readdirSync(pastaAno, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => (parseInt(a, 10) - parseInt(b, 10)) || a.localeCompare(b));

    for (const slug of pastas) {
      const numero = parseInt(slug, 10);
      if (!Number.isFinite(numero)) {
        descartadas.push({ ano, numero: slug, defeitos: ['pasta sem numero'] });
        continue;
      }

      const arq = path.join(pastaAno, slug, 'details.json');
      if (!fs.existsSync(arq)) continue;

      let q;
      try {
        q = JSON.parse(fs.readFileSync(arq, 'utf8'));
      } catch {
        descartadas.push({ ano, numero: slug, defeitos: ['json invalido'] });
        continue;
      }

      const d = defeitos(q);
      if (d.length) { descartadas.push({ ano, numero: slug, defeitos: d }); continue; }

      let faltou = false;
      const resolver = (url) => {
        const p = copiarImagem(url, ano, slug, copiadas);
        if (!p) { faltou = true; imagensFaltando.push({ ano, slug, url }); }
        return p;
      };

      // Texto de apoio e enunciado vem em Markdown: viram blocos, com as
      // imagens na posicao em que aparecem no texto.
      const ctx = paraBlocos(q.context || '', resolver);
      const intro = paraBlocos(q.alternativesIntroduction || '', resolver);
      const usadasNoTexto = new Set([...ctx.usadas, ...intro.usadas]);

      // Imagens de `files` que o texto NAO referencia ficam como anexo ao fim.
      // Sem isso, as que o Markdown ja traz apareceriam duas vezes.
      const imagensExtra = [];
      for (const f of q.files || []) {
        const p = copiarImagem(f, ano, slug, copiadas);
        if (!p) { faltou = true; imagensFaltando.push({ ano, slug, url: f }); continue; }
        if (!usadasNoTexto.has(p)) imagensExtra.push(p);
      }

      // Alternativas (algumas sao imagem em vez de texto; outras tem negrito)
      const alternativas = [];
      for (const a of q.alternatives) {
        let imagem = null;
        if (a.file) {
          imagem = copiarImagem(a.file, ano, slug, copiadas);
          if (!imagem) { faltou = true; imagensFaltando.push({ ano, slug, url: a.file }); }
        }
        const alt = paraBlocos(a.text || '', resolver);
        alternativas.push({
          letra: String(a.letter).toUpperCase(),
          blocos: alt.blocos,
          imagem,
        });
      }

      // Se alguma imagem nao existe fisicamente, a questao fica incompleta: descarta.
      if (faltou) { descartadas.push({ ano, numero: slug, defeitos: ['imagem ausente'] }); continue; }

      // Resumo em texto puro: o relatorio do professor precisa identificar a
      // questao numa celula de tabela, onde blocos nao servem.
      const resumo = (paraTextoPuro(intro.blocos) || paraTextoPuro(ctx.blocos)).slice(0, 160);

      questoes.push({
        id: `${ano}-${slug}`,   // slug, nao numero: ver comentario acima
        ano,
        numero,
        area: q.discipline,
        idioma: q.language || null,
        conteudo: ctx.blocos,
        enunciado: intro.blocos,
        imagens_extra: imagensExtra,
        resumo,
        alternativas,
        gabarito: String(q.correctAlternative).toUpperCase(),
      });

      porArea[q.discipline] = (porArea[q.discipline] || 0) + 1;
      porAno[ano] = (porAno[ano] || 0) + 1;
    }
  }

  fs.mkdirSync(path.join(RAIZ, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(RAIZ, 'data', 'questoes.json'),
    JSON.stringify(questoes, null, 1),
    'utf8',
  );

  // ------------------------------------------------------------- relatorio
  const motivos = {};
  for (const x of descartadas) for (const m of x.defeitos) motivos[m] = (motivos[m] || 0) + 1;

  log('\n=============== RELATORIO DA PREPARACAO ===============');
  log(`Questoes aproveitadas : ${questoes.length}`);
  log(`Questoes descartadas  : ${descartadas.length}`);
  log(`Motivos do descarte   : ${JSON.stringify(motivos)}`);
  log(`Imagens copiadas      : ${copiadas.length}`);
  log(`Imagens faltando      : ${imagensFaltando.length}`);
  log('\nPor area:');
  for (const [a, n] of Object.entries(porArea).sort((x, y) => y[1] - x[1])) {
    log(`  ${a.padEnd(20)} ${String(n).padStart(4)}  -> ${Math.floor(n / 45)} simulados de 45q sem repetir`);
  }
  log('\nPor ano:');
  for (const [a, n] of Object.entries(porAno)) log(`  ${a}: ${n}`);
  log('\nGravado em data/questoes.json');
  log('Proximo passo: npm run importar');
  log('=======================================================\n');

  if (questoes.length === 0) {
    console.error('ERRO: nenhuma questao aproveitada. Confira o clone em .cache-enem-api/');
    process.exit(1);
  }
}

main();
