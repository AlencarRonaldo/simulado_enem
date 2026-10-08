#!/usr/bin/env node
/**
 * Importa data/questoes.json para o Postgres.
 *
 *   node scripts/importar-db.mjs
 *
 * Le DATABASE_URL de .env.local. Idempotente: rodar de novo atualiza as
 * questoes existentes (ON CONFLICT DO UPDATE) sem duplicar nada e sem
 * quebrar simulados que ja apontam para elas.
 */

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ---- carrega .env.local sem dependencia externa
function carregarEnv() {
  const arq = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(arq)) {
    console.error('ERRO: .env.local nao encontrado. Copie .env.local.example e preencha.');
    process.exit(1);
  }
  for (const linha of fs.readFileSync(arq, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

/**
 * Mesma regra de lib/conexao.ts, repetida aqui de proposito: este script roda
 * com `node` puro, sem passar pelo build do Next, e nao consegue importar o .ts.
 * Se mudar a regra la, mude aqui.
 */
function sslPara(url) {
  try {
    const u = new URL(url);
    const modo = u.searchParams.get('sslmode');
    if (modo === 'disable') return false;
    if (modo) return { rejectUnauthorized: modo === 'verify-full' };
    const local = ['localhost', '127.0.0.1', '::1', ''].includes(u.hostname);
    return local ? false : { rejectUnauthorized: false };
  } catch {
    return { rejectUnauthorized: false };
  }
}

async function main() {
  carregarEnv();

  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL vazia em .env.local');
    process.exit(1);
  }

  const arqJson = path.join(RAIZ, 'data', 'questoes.json');
  if (!fs.existsSync(arqJson)) {
    console.error('ERRO: data/questoes.json nao existe. Rode primeiro: npm run preparar');
    process.exit(1);
  }

  const questoes = JSON.parse(fs.readFileSync(arqJson, 'utf8'));
  console.log(`> ${questoes.length} questoes para importar`);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: sslPara(process.env.DATABASE_URL),
  });
  await client.connect();

  // Confere que o schema foi criado.
  const t = await client.query(`select to_regclass('public.questoes') as t`);
  if (!t.rows[0].t) {
    console.error('ERRO: tabela "questoes" nao existe. Rode db/schema.sql no banco primeiro.');
    await client.end();
    process.exit(1);
  }

  const SQL_BASE = `
    insert into questoes
      (id, ano, numero, area, idioma, conteudo, enunciado, imagens_extra, resumo, alternativas, gabarito)
  `;
  const SQL_CONFLITO = `
    on conflict (id) do update set
      ano = excluded.ano,
      numero = excluded.numero,
      area = excluded.area,
      idioma = excluded.idioma,
      conteudo = excluded.conteudo,
      enunciado = excluded.enunciado,
      imagens_extra = excluded.imagens_extra,
      resumo = excluded.resumo,
      alternativas = excluded.alternativas,
      gabarito = excluded.gabarito
  `;

  // Em lote: cada ida ao banco custa ~0,3s de latencia com o Supabase. Uma
  // questao por vez levaria 8 minutos; com 25 por query sao ~60 idas.
  const TAM_LOTE = 25;

  let n = 0;
  await client.query('begin');
  try {
    for (let i = 0; i < questoes.length; i += TAM_LOTE) {
      const lote = questoes.slice(i, i + TAM_LOTE);
      const params = [];
      const valores = lote.map((q) => {
        const b = params.length;
        params.push(
          q.id, q.ano, q.numero, q.area, q.idioma,
          JSON.stringify(q.conteudo), JSON.stringify(q.enunciado),
          JSON.stringify(q.imagens_extra), q.resumo,
          JSON.stringify(q.alternativas),
          q.gabarito,
        );
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6}::jsonb,$${b + 7}::jsonb,$${b + 8}::jsonb,$${b + 9},$${b + 10}::jsonb,$${b + 11})`;
      });
      await client.query(
        `${SQL_BASE}\nvalues ${valores.join(',\n')}\n${SQL_CONFLITO}`,
        params,
      );
      n += lote.length;
      console.log(`  ${n}/${questoes.length}`);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  }

  const r = await client.query(
    `select area, count(*)::int as n from questoes group by area order by n desc`,
  );
  console.log(`\n> ${n} questoes importadas. Total no banco por area:`);
  for (const row of r.rows) console.log(`  ${row.area.padEnd(20)} ${row.n}`);

  await client.end();
  console.log('\nPronto. Agora: npm run dev, e abra /professor para criar o primeiro simulado.');
}

main().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
