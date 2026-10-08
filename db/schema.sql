-- Schema do Sistema ENEM. Rode uma vez no SQL Editor do Supabase (ou psql).
-- Seguro rodar novamente: tudo e "if not exists".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- questoes
-- Os textos sao guardados como BLOCOS (jsonb), nao como texto puro, porque o
-- acervo vem em Markdown e as imagens aparecem no meio do texto de apoio. Um
-- bloco e {"tipo":"paragrafo","partes":[{"texto":"...","forte":false}]} ou
-- {"tipo":"imagem","src":"/q/2023/84/abc.jpg"}. Guardar texto puro perderia a
-- posicao das imagens; guardar Markdown cru obrigaria a interpretar no cliente,
-- a cada questao, durante a prova.
create table if not exists questoes (
  id            text primary key,          -- ex: '2023-84' ou '2015-91-espanhol'
  ano           int  not null,
  numero        int  not null,             -- numero da questao na prova original
  area          text not null,             -- linguagens | ciencias-humanas | ciencias-natureza | matematica
  idioma        text,                      -- ingles | espanhol | null (so em linguagens)
  conteudo      jsonb not null default '[]'::jsonb,  -- blocos do texto de apoio
  enunciado     jsonb not null default '[]'::jsonb,  -- blocos da pergunta
  imagens_extra jsonb not null default '[]'::jsonb,  -- imagens que o texto nao referencia
  resumo        text,                      -- texto puro curto, para o relatorio
  alternativas  jsonb not null,            -- [{"letra":"A","blocos":[...],"imagem":null}, ...]
  gabarito      char(1) not null
);

create index if not exists questoes_area_idx   on questoes (area);
create index if not exists questoes_ano_idx    on questoes (ano);
create index if not exists questoes_idioma_idx on questoes (idioma);

-- --------------------------------------------------------------- simulados
create table if not exists simulados (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  modo        text not null,   -- dia1 | dia2 | area
  duracao_min int  not null,
  ativo       boolean not null default true,
  -- true quando o PROPRIO ALUNO gerou a prova no treino livre: nasce fechada
  -- (ativo = false) para nao aparecer na lista da turma, e o mesmo RA pode
  -- fazer varios (a trava de RA e por simulado).
  automatico  boolean not null default false,
  criado_em   timestamptz not null default now()
);

create table if not exists simulado_questoes (
  simulado_id uuid not null references simulados(id) on delete cascade,
  ordem       int  not null,
  questao_id  text not null references questoes(id),
  primary key (simulado_id, ordem)
);

create index if not exists simulado_questoes_sim_idx on simulado_questoes (simulado_id);

-- -------------------------------------------------------------- tentativas
create table if not exists tentativas (
  id            uuid primary key default gen_random_uuid(),
  simulado_id   uuid not null references simulados(id) on delete cascade,
  nome          text not null,
  ra            text not null,
  sala          text not null,
  duracao_min   int  not null,          -- copiado do simulado no inicio: mudar o simulado depois
                                        -- nao altera o tempo de quem ja comecou
  iniciado_em   timestamptz not null default now(),
  finalizado_em timestamptz
);

-- A TRAVA POR RA: um RA so pode ter uma tentativa por simulado.
-- Normalizado em lower()+trim() para "12345 " e "12345" nao virarem duas tentativas.
create unique index if not exists tentativas_ra_unica
  on tentativas (simulado_id, lower(btrim(ra)));

create index if not exists tentativas_simulado_idx on tentativas (simulado_id);

-- --------------------------------------------------------------- respostas
-- Tabela propria (nao um JSON blob) porque o relatorio do professor precisa
-- agrupar por questao: "quais questoes a turma mais errou".
create table if not exists respostas (
  tentativa_id  uuid    not null references tentativas(id) on delete cascade,
  questao_id    text    not null references questoes(id),
  letra         char(1) not null,
  respondido_em timestamptz not null default now(),
  primary key (tentativa_id, questao_id)
);

create index if not exists respostas_questao_idx on respostas (questao_id);
