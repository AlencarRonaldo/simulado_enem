'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatarTempo, nomeArea } from '@/lib/enem';
import type { QuestaoAluno } from '@/lib/tentativa';
import { Blocos } from './Blocos';

const RESSINCRONIZAR_MS = 30_000;  // confere o tempo com o servidor
const REENVIAR_MS = 4_000;         // tenta de novo as respostas que falharam
const URGENTE_S = 300;             // ultimos 5 minutos

type Props = {
  tentativaId: string;
  titulo: string;
  nome: string;
  restanteInicial: number;
  questoes: QuestaoAluno[];
  respostasIniciais: Record<string, string>;
};

export function Prova({
  tentativaId, titulo, nome, restanteInicial, questoes, respostasIniciais,
}: Props) {
  const router = useRouter();

  const [i, setI] = useState(() => {
    // Abre na primeira questao sem resposta: retomar depois de queda de internet
    // nao deve jogar o aluno de volta na questao 1.
    const idx = questoes.findIndex((q) => !respostasIniciais[q.id]);
    return idx === -1 ? 0 : idx;
  });
  const [respostas, setRespostas] = useState<Record<string, string>>(respostasIniciais);
  const [restante, setRestante] = useState(restanteInicial);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [problemaRede, setProblemaRede] = useState(false);

  // Respostas que o servidor ainda nao confirmou. O aluno ja ve a marcacao
  // (otimista), e isto garante que ela chegue mesmo com a rede instavel.
  const pendentes = useRef<Map<string, string>>(new Map());
  const finalizado = useRef(false);

  const q = questoes[i];
  const total = questoes.length;
  const respondidas = Object.keys(respostas).length;

  // ---------------------------------------------------------------- envio
  const enviar = useCallback(async (questaoId: string, letra: string) => {
    try {
      const r = await fetch('/api/resposta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tentativa_id: tentativaId, questao_id: questaoId, letra }),
      });
      if (r.status === 409) {           // tempo acabou no servidor
        finalizado.current = true;
        router.replace(`/resultado/${tentativaId}`);
        return true;
      }
      if (!r.ok) return false;
      pendentes.current.delete(questaoId);
      if (pendentes.current.size === 0) setProblemaRede(false);
      return true;
    } catch {
      return false;
    }
  }, [tentativaId, router]);

  function marcar(letra: string) {
    if (!q || restante <= 0) return;
    setRespostas((r) => ({ ...r, [q.id]: letra }));
    pendentes.current.set(q.id, letra);
    void enviar(q.id, letra).then((ok) => { if (!ok) setProblemaRede(true); });
  }

  // Reenvia o que ficou pendente, até o servidor confirmar.
  useEffect(() => {
    const t = setInterval(() => {
      if (pendentes.current.size === 0) return;
      for (const [qid, letra] of [...pendentes.current]) void enviar(qid, letra);
    }, REENVIAR_MS);
    return () => clearInterval(t);
  }, [enviar]);

  // --------------------------------------------------------------- tempo
  // O contador local e só visual. A cada 30s o servidor diz o tempo real —
  // se divergirem, o servidor manda.
  useEffect(() => {
    const t = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;

    async function sincronizar() {
      try {
        const r = await fetch(`/api/tentativa/${tentativaId}`, { cache: 'no-store' });
        if (!r.ok || !vivo) return;
        const d = await r.json();
        setProblemaRede(false);
        if (d.finalizada) {
          finalizado.current = true;
          router.replace(`/resultado/${tentativaId}`);
          return;
        }
        setRestante(d.restante_s);
        // O servidor tem a palavra final sobre o que foi salvo; mas nao apaga
        // marcacao que ainda esta na fila de envio.
        setRespostas((atual) => ({ ...d.respostas, ...Object.fromEntries(pendentes.current) }));
      } catch {
        setProblemaRede(true);
      }
    }

    const t = setInterval(sincronizar, RESSINCRONIZAR_MS);
    // Volta de aba em segundo plano ou de queda de rede: confere na hora.
    const aoVoltar = () => { if (document.visibilityState === 'visible') void sincronizar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', sincronizar);

    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', sincronizar);
    };
  }, [tentativaId, router]);

  // Tempo zerou no cliente: confirma com o servidor e sai.
  useEffect(() => {
    if (restante > 0 || finalizado.current) return;
    finalizado.current = true;
    void fetch(`/api/tentativa/${tentativaId}`, { cache: 'no-store' })
      .finally(() => router.replace(`/resultado/${tentativaId}`));
  }, [restante, tentativaId, router]);

  // ----------------------------------------------------------- entregar
  async function entregar() {
    const faltam = total - respondidas;
    const texto = faltam > 0
      ? `Você deixou ${faltam} ${faltam === 1 ? 'questão' : 'questões'} em branco. Entregar mesmo assim? Não tem como voltar.`
      : 'Entregar o simulado? Não tem como voltar.';
    if (!window.confirm(texto)) return;

    setEntregando(true);
    // Garante que nada ficou na fila antes de fechar.
    for (const [qid, letra] of [...pendentes.current]) await enviar(qid, letra);
    await fetch('/api/finalizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tentativa_id: tentativaId }),
    }).catch(() => {});
    finalizado.current = true;
    router.replace(`/resultado/${tentativaId}`);
  }

  // Avisa antes de fechar a aba — sem travar, só um alerta do navegador.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (finalizado.current) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, []);

  // Teclado: A–E marca, setas navegam. Ajuda quem faz no computador.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;

      const k = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(k)) { marcar(k); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setI((x) => Math.min(total - 1, x + 1)); }
      else if (e.key === 'ArrowLeft') { setI((x) => Math.max(0, x - 1)); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!q) return null;

  const urgente = restante <= URGENTE_S;

  return (
    <div className="prova">
      <div className="barra">
        <span className="barra-id">
          {titulo} · {nome.split(' ')[0]}
        </span>
        <span className="barra-pos">
          {i + 1}/{total}
        </span>
        <span
          className={`relogio${urgente ? ' urgente' : ''}`}
          role="timer"
          aria-live="off"
          title="Tempo restante"
        >
          {formatarTempo(restante)}
        </span>
      </div>

      {urgente && (
        <div className="aviso" style={{ borderRadius: 0, borderLeft: 0, borderBottom: '1px solid var(--alerta)' }}>
          Menos de 5 minutos. Ao zerar, o simulado é entregue automaticamente com o que você já marcou.
        </div>
      )}

      {problemaRede && (
        <div className="aviso" style={{ borderRadius: 0, borderLeft: 0, borderBottom: '1px solid var(--alerta)' }}>
          Sem conexão com o servidor. Suas marcações estão guardadas aqui e serão enviadas
          quando a internet voltar. Não feche a página.
        </div>
      )}

      <div className="prova-corpo">
        {/* ------------------------------------------------------ caderno */}
        <article className="folha-papel caderno">
          <header className="caderno-cabeca">
            <span className="caderno-numero">Questão {i + 1}</span>
            <span className="caderno-origem">
              ENEM {q.ano}, questão {q.numero}
              {q.idioma ? ` · ${q.idioma === 'ingles' ? 'Inglês' : 'Espanhol'}` : ''}
            </span>
            <span className="tag-area" data-area={q.area}>
              {nomeArea(q.area).split(' e suas')[0]}
            </span>
          </header>

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
              const marcada = respostas[q.id] === a.letra;
              return (
                <li key={a.letra}>
                  <label className={`alternativa${marcada ? ' marcada' : ''}`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={marcada}
                      onChange={() => marcar(a.letra)}
                    />
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
                  </label>
                </li>
              );
            })}
          </ul>

          <nav className="navegacao">
            <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
              Anterior
            </button>
            <span className="espaco" />
            {i < total - 1 ? (
              <button className="botao-principal" onClick={() => setI((x) => x + 1)}>
                Próxima
              </button>
            ) : (
              <button className="botao-principal" onClick={entregar} disabled={entregando}>
                {entregando ? 'Entregando…' : 'Entregar'}
              </button>
            )}
          </nav>
        </article>

        {/* ------------------------------------------- folha de respostas */}
        <aside className={`folha-papel folha-lateral${folhaAberta ? ' aberta' : ''}`}>
          <div className="folha">
            <div className="folha-cabeca">
              <span>Folha de respostas</span>
              <span className="folha-contagem">{respondidas}/{total}</span>
            </div>

            <div className="grade">
              {questoes.map((qq, idx) => (
                <button
                  key={qq.id}
                  className={`grade-item${respostas[qq.id] ? ' respondida' : ''}${idx === i ? ' atual' : ''}`}
                  onClick={() => { setI(idx); setFolhaAberta(false); }}
                  aria-label={`Questão ${idx + 1}${respostas[qq.id] ? `, marcada ${respostas[qq.id]}` : ', em branco'}`}
                  aria-current={idx === i ? 'true' : undefined}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <div className="folha-rodape">
              <button
                className="botao-perigo"
                style={{ width: '100%' }}
                onClick={entregar}
                disabled={entregando}
              >
                Entregar agora
              </button>
              <p className="nota" style={{ marginTop: '.625rem', marginBottom: 0 }}>
                Cada marcação é salva na hora. No computador, as teclas A a E marcam
                e as setas mudam de questão.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Barra inferior só no celular: abre a folha de respostas */}
      <button className="folha-botao-mobile" onClick={() => setFolhaAberta((v) => !v)}>
        <span>{folhaAberta ? 'Fechar folha' : 'Folha de respostas'}</span>
        <span>{respondidas}/{total}</span>
      </button>
    </div>
  );
}
