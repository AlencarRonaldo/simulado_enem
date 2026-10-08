'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AREAS, AREAS_LISTA, MODOS, type Area, type Modo } from '@/lib/enem';

export type SimuladoAberto = {
  id: string;
  titulo: string;
  modo: string;
  duracao_min: number;
  questoes: number;
};

/** Valor do radio "prova sorteada na hora" — nao e um id de simulado. */
const TREINO = 'treino';

function horas(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export function FormularioEntrada({ simulados }: { simulados: SimuladoAberto[] }) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [ra, setRa] = useState('');
  const [sala, setSala] = useState('');
  const [escolhido, setEscolhido] = useState(simulados[0]?.id ?? TREINO);
  const [tipo, setTipo] = useState<Modo>('dia2');
  const [area, setArea] = useState<Area>('matematica');
  const [idioma, setIdioma] = useState('ingles');
  const [erro, setErro] = useState<string | null>(null);
  const [resultadoId, setResultadoId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ehTreino = escolhido === TREINO;
  const sim = simulados.find((s) => s.id === escolhido);
  const precisaIdioma = tipo === 'dia1' || (tipo === 'area' && area === 'linguagens');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultadoId(null);
    setEnviando(true);
    try {
      const r = await fetch(ehTreino ? '/api/treino' : '/api/iniciar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          ehTreino
            ? { nome, ra, sala, modo: tipo, area: tipo === 'area' ? area : undefined, idioma }
            : { simulado_id: escolhido, nome, ra, sala },
        ),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? 'Não foi possível entrar.');
        if (d.resultado_id) setResultadoId(d.resultado_id);
        setEnviando(false);
        return;
      }
      router.push(`/simulado/${d.tentativa_id}`);
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.');
      setEnviando(false);
    }
  }

  return (
    /* Sem moldura de cartao: o formulario e a folha de inscricao picotada ao
       lado da capa, separada por um fio (feito no CSS da coluna). */
    <form className="formulario" onSubmit={entrar}>
      {/* Legenda em versalete, como rotulo de formulario impresso. */}
      <p className="campos-legenda">Seus dados</p>

      <label className="campo">
        <span>Nome completo</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="name"
          required
          minLength={3}
        />
      </label>

      <div className="linha-campos">
        <label className="campo">
          <span>RA</span>
          <input
            value={ra}
            onChange={(e) => setRa(e.target.value)}
            inputMode="numeric"
            required
          />
          <span className="dica">O mesmo da sua carteirinha.</span>
        </label>

        <label className="campo">
          <span>Sala</span>
          <input
            value={sala}
            onChange={(e) => setSala(e.target.value)}
            placeholder="3A"
            required
          />
        </label>
      </div>

      <p className="campos-legenda" style={{ marginTop: '1.75rem' }}>
        O que você vai fazer
      </p>

      {/* Cada opcao e uma linha com bolha a esquerda — o mesmo objeto da folha
          de respostas da prova. Fio embaixo, nao caixa em volta. */}
      {simulados.map((s) => (
        <label key={s.id} className={`escolha-simulado${escolhido === s.id ? ' ativa' : ''}`}>
          <input
            type="radio"
            name="simulado"
            value={s.id}
            checked={escolhido === s.id}
            onChange={() => setEscolhido(s.id)}
          />
          <span className="escolha-bolha" aria-hidden="true" />
          <span className="escolha-texto">
            <span className="escolha-titulo">{s.titulo}</span>
            <span className="escolha-meta">
              {s.questoes} questões · {horas(s.duracao_min)}
            </span>
          </span>
        </label>
      ))}

      <label className={`escolha-simulado${ehTreino ? ' ativa' : ''}`}>
        <input
          type="radio"
          name="simulado"
          value={TREINO}
          checked={ehTreino}
          onChange={() => setEscolhido(TREINO)}
        />
        <span className="escolha-bolha" aria-hidden="true" />
        <span className="escolha-texto">
          <span className="escolha-titulo">Treino livre</span>
          <span className="escolha-meta">
            A prova é sorteada agora, no padrão do ENEM, com questões de 2015 a 2023.
            Você pode fazer quantas vezes quiser.
          </span>
        </span>
      </label>

      {ehTreino && (
        <div className="linha-campos" style={{ marginTop: '.75rem' }}>
          <label className="campo">
            <span>Tipo de prova</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Modo)}>
              {(Object.keys(MODOS) as Modo[]).map((m) => (
                <option key={m} value={m}>
                  {MODOS[m].nome} — {MODOS[m].questoes} questões, {horas(MODOS[m].duracao_min)}
                </option>
              ))}
            </select>
          </label>

          {tipo === 'area' && (
            <label className="campo">
              <span>Área</span>
              <select value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {AREAS_LISTA.map((a) => (
                  <option key={a} value={a}>{AREAS[a]}</option>
                ))}
              </select>
            </label>
          )}

          {precisaIdioma && (
            <label className="campo">
              <span>Língua estrangeira</span>
              <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
                <option value="ingles">Inglês</option>
                <option value="espanhol">Espanhol</option>
              </select>
              <span className="dica">5 das 45 questões de Linguagens.</span>
            </label>
          )}
        </div>
      )}

      {sim && (
        <p className="nota" style={{ marginTop: '1rem' }}>
          O cronômetro começa quando você clicar em começar e não para, nem se você
          fechar a página. Suas respostas são salvas sozinhas, uma por uma. Se a
          internet cair, entre com o mesmo RA e você volta de onde parou.
        </p>
      )}

      {ehTreino && (
        <p className="nota" style={{ marginTop: '1rem' }}>
          O cronômetro começa assim que a prova abrir e não para, nem se você
          fechar a página. Suas respostas são salvas sozinhas, uma por uma.
        </p>
      )}

      {erro && (
        <div className="aviso" style={{ marginTop: '1rem' }}>
          {erro}
          {resultadoId && (
            <>
              {' '}
              <a href={`/resultado/${resultadoId}`}>Ver seu resultado</a>.
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        className="botao-principal"
        style={{ width: '100%', marginTop: '1.25rem' }}
        disabled={enviando || !escolhido}
      >
        {enviando
          ? ehTreino ? 'Sorteando suas questões…' : 'Entrando…'
          : ehTreino ? 'Gerar minha prova e começar' : 'Começar o simulado'}
      </button>
    </form>
  );
}
