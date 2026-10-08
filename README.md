# Sistema ENEM — simulado para os alunos

Aplicação web onde o aluno entra com nome, RA e sala, faz um simulado com
questões reais do ENEM e recebe o resultado. O professor monta os simulados e
acompanha o desempenho das turmas.

## O que já está pronto

- **1.541 questões** das provas oficiais de 2015 a 2023, com as imagens.
- **Três modos de simulado**, fiéis à prova real:

  | Modo | Composição | Questões | Tempo |
  |---|---|---|---|
  | Dia 1 | Linguagens 45 (5 de inglês ou espanhol) + Humanas 45 | 90 | 5h30 |
  | Dia 2 | Natureza 45 + Matemática 45 | 90 | 5h00 |
  | Área única | 45 de uma área | 45 | 1h30 |

- **Cronômetro no servidor.** Recarregar a página não devolve tempo.
- **Salvamento a cada clique.** Se a internet cair, nada se perde; o aluno entra
  com o mesmo RA e volta de onde parou.
- **Uma tentativa por RA.** Prova concluída não pode ser refeita.
- **Gabarito nunca vai para o navegador** durante a prova.
- **Relatórios**: acerto por área, por sala, questões que a turma mais errou com
  a distribuição das marcações, e as notas em CSV.

A **redação não está implementada** — só questões objetivas.

## Instalação

Precisa de Node 20 ou mais novo e de um banco Postgres.

### 1. Criar o banco

Crie um projeto gratuito no [Supabase](https://supabase.com). Em
**Project Settings → Database → Connection string → Connection pooling**, copie a
string da **porta 6543** (a 6543 é o pooler; a 5432 esgota conexões em serverless).

No **SQL Editor** do Supabase, cole e rode o conteúdo de `db/schema.sql`.

### 2. Configurar

```bash
cp .env.local.example .env.local
```

Abra `.env.local` e preencha `DATABASE_URL` com a string copiada e
`SENHA_PROFESSOR` com uma senha sua.

### 3. Instalar e carregar as questões

```bash
npm install
npm run preparar    # baixa o acervo e monta data/questoes.json + as imagens
npm run importar    # envia as questões para o banco
```

O `preparar` clona o repositório aberto
[yunger7/enem-api](https://github.com/yunger7/enem-api) (~110 MB) em
`.cache-enem-api/`. É demorado só na primeira vez.

Ele imprime um relatório ao final. O esperado é:

```
Questoes aproveitadas : 1541
Questoes descartadas  : 113
Imagens faltando      : 0
```

As 113 descartadas têm defeito de origem (texto de apoio perdido na raspagem dos
PDFs, 4 alternativas em vez de 5, alternativa vazia) e ficam de fora de propósito
— ver as regras em `scripts/preparar-questoes.mjs`, função `defeitos()`.

### 4. Rodar

```bash
npm run dev
```

Abra `http://localhost:3000/professor`, entre com a senha e monte o primeiro
simulado. Os alunos entram pela raiz (`/`).

## Publicar

Suba o repositório para o GitHub e importe na [Vercel](https://vercel.com). Em
**Settings → Environment Variables**, cadastre `DATABASE_URL` e
`SENHA_PROFESSOR`. O deploy é automático a cada push.

`data/questoes.json` e `public/q/` (as imagens, ~59 MB) **entram no Git** — a
Vercel publica o que está no repositório, e sem eles as questões apareceriam sem
imagem. Só o cache do clone (`.cache-enem-api/`) fica de fora.

## Como funciona por dentro

```
app/
  page.tsx                      entrada do aluno (nome, RA, sala)
  simulado/[id]/Prova.tsx       a prova: cronômetro, autosave, folha de respostas
  resultado/[id]/               resultado do aluno
  professor/                    painel e relatórios
  api/
    iniciar/                    cria ou retoma a tentativa (trava por RA)
    resposta/                   autosave de cada marcação
    tentativa/[id]/             tempo restante, calculado no servidor
    finalizar/                  entrega antecipada
    professor/                  login, montar simulado, relatório, CSV
lib/
  tentativa.ts                  tempo, correção e questões sem gabarito
  relatorio.ts                  as consultas agregadas do professor
  enem.ts                       estrutura oficial da prova
scripts/
  preparar-questoes.mjs         acervo -> data/questoes.json + public/q/
  markdown.mjs                  converte o Markdown do acervo em blocos
  importar-db.mjs               data/questoes.json -> Postgres
db/schema.sql                   as cinco tabelas
```

### Decisões que valem saber

**O tempo vem sempre do banco (`now()`), nunca do navegador nem do Node.** O
contador que o aluno vê é enfeite e ressincroniza a cada 30 s. Se fosse do
navegador, bastava recarregar a página para ganhar o tempo todo de novo; se fosse
do Node, instâncias diferentes em serverless divergiriam entre si.

**Cada marcação vai para o banco na hora**, com reenvio automático enquanto o
servidor não confirmar. Internet de escola cai; salvar só no "entregar" perderia
a prova inteira.

**Os textos são guardados como blocos JSON, não como texto puro.** O acervo vem
em Markdown, com imagens no meio do texto de apoio: 38% das questões têm
`![](url)` dentro do texto e 44% têm negrito. Guardar texto puro mostraria
`![](https://…)` para o aluno e perderia a imagem; guardar Markdown cru obrigaria
a interpretar 90 questões no celular a cada carregamento.

**As questões de língua estrangeira têm o idioma no identificador**
(`2015-91-ingles`), porque inglês e espanhol compartilham o mesmo número de
questão na prova real e colidiriam.

**O gabarito não sai do servidor durante a prova.** A correção também é feita lá.

## Limites conhecidos

- **A nota é de acertos brutos.** O ENEM usa TRI, que pesa cada questão pela
  dificuldade a partir do desempenho de todos os participantes. Não é
  reproduzível com uma turma, e o sistema diz isso ao aluno.
- **2024 e 2025 não estão no acervo.** Entram extraindo dos PDFs do INEP.
- **Sem redação.**
- **Um professor, uma senha.** Para logins separados por professor, trocar
  `lib/auth.ts` por uma tabela de usuários.
- **Nada impede o aluno de abrir outra aba** para pesquisar. O sistema é de
  treino, não de prova vigiada.

## Fontes

- Banco de questões: [enem-api](https://github.com/yunger7/enem-api) (GPL-2.0),
  raspado das provas publicadas pelo INEP.
- Provas e gabaritos oficiais: [INEP](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos).
