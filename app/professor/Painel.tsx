'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AREAS, AREAS_LISTA, MODOS, type Area, type Modo } from '@/lib/enem';

type Simulado = {
  id: string;
  titulo: string;
  modo: Modo;
  duracao_min: number;
  ativo: boolean;
  criado_em: string;
  automatico: boolean;
  questoes: number;
  tentativas: number;
  concluidas: number;
};

function horas(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`;
}

export function Painel() {
  const router = useRouter();
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modo, setModo] = useState<Modo>('area');
  const [area, setArea] = useState<Area>('matematica');
  const [idioma, setIdioma] = useState('ingles');
  const [anoMin, setAnoMin] = useState(2015);
  const [anoMax, setAnoMax] = useState(2023);
  const [titulo, setTitulo] = useState('');
  const [duracao, setDuracao] = useState<number | ''>('');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState<string | null>(null);

  async function carregar() {
    try {
      const r = await fetch('/api/professor/simulados', { cache: 'no-store' });
      if (r.status === 401) { router.refresh(); return; }
      setSimulados((await r.json()).simulados ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCriado(null);
    setCriando(true);
    try {
      const r = await fetch('/api/professor/simulados', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo, modo, area: modo === 'area' ? area : undefined, idioma,
          ano_min: anoMin, ano_max: anoMax,
          duracao_min: duracao === '' ? undefined : duracao,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.erro ?? 'Não foi possível criar.'); return; }
      setCriado(d.id);
      setTitulo('');
      await carregar();
    } catch {
      setErro('Sem conexão.');
    } finally {
      setCriando(false);
    }
  }

  async function alternar(s: Simulado) {
    await fetch('/api/professor/simulados', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, ativo: !s.ativo }),
    });
    await carregar();
  }

  const precisaIdioma = modo === 'dia1' || (modo === 'area' && area === 'linguagens');

  return (
    <>
      {/* ------------------------------------------------- montar simulado */}
      <section className="secao">
        <h2 className="secao-titulo">Montar um simulado</h2>
        <form className="folha-papel cartao" onSubmit={criar}>
          <label className="campo">
            <span>Tipo</span>
            <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
              {(Object.keys(MODOS) as Modo[]).map((m) => (
                <option key={m} value={m}>
                  {MODOS[m].nome} — {MODOS[m].questoes} questões, {horas(MODOS[m].duracao_min)}
                </option>
              ))}
            </select>
          </label>

          <div className="linha-campos">
            {modo === 'area' && (
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

          <div className="linha-campos">
            <label className="campo">
              <span>De qual ano</span>
              <select value={anoMin} onChange={(e) => setAnoMin(+e.target.value)}>
                {Array.from({ length: 9 }, (_, k) => 2015 + k).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Até qual ano</span>
              <select value={anoMax} onChange={(e) => setAnoMax(+e.target.value)}>
                {Array.from({ length: 9 }, (_, k) => 2015 + k).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Minutos</span>
              <input
                type="number"
                min={5}
                max={400}
                value={duracao}
                placeholder={String(MODOS[modo].duracao_min)}
                onChange={(e) => setDuracao(e.target.value === '' ? '' : +e.target.value)}
              />
              <span className="dica">Vazio = tempo oficial.</span>
            </label>
          </div>

          <label className="campo">
            <span>Nome do simulado</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Simulado 3º bimestre — 3A e 3B"
            />
            <span className="dica">É o que o aluno vê na tela de entrada.</span>
          </label>

          {erro && <div className="aviso">{erro}</div>}

          {criado && (
            <div className="folha-papel" style={{ padding: '.875rem', marginBottom: '.75rem' }}>
              <h3>Simulado criado e aberto</h3>
              <p className="nota" style={{ marginTop: 0 }}>
                Passe este endereço para os alunos — eles escolhem o simulado na lista:
              </p>
              <div className="link-aluno">
                {typeof window !== 'undefined' ? window.location.origin : ''}/
              </div>
            </div>
          )}

          <button type="submit" className="botao-principal" disabled={criando}>
            {criando ? 'Sorteando questões…' : 'Montar simulado'}
          </button>
          <p className="nota" style={{ marginBottom: 0, marginTop: '.75rem' }}>
            As questões são sorteadas agora e ficam fixas: todos os alunos fazem a
            mesma prova, na mesma ordem.
          </p>
        </form>
      </section>

      {/* -------------------------------------------------------- simulados */}
      <section className="secao">
        <h2 className="secao-titulo">Simulados</h2>

        {carregando ? (
          <p className="nota">Carregando…</p>
        ) : simulados.length === 0 ? (
          <div className="folha-papel cartao">
            <p className="nota" style={{ margin: 0 }}>Nenhum simulado ainda. Monte o primeiro acima.</p>
          </div>
        ) : (
          <div className="lista-simulados">
            {simulados.map((s) => (
              <div className="folha-papel item-simulado" key={s.id}>
                <div className="cresce">
                  <div className="item-titulo">{s.titulo}</div>
                  <div className="item-meta">
                    {s.questoes} questões · {horas(s.duracao_min)} ·{' '}
                    {s.tentativas} {s.tentativas === 1 ? 'aluno' : 'alunos'}
                    {s.tentativas > 0 && ` (${s.concluidas} concluíram)`}
                  </div>
                </div>
                {s.automatico && <span className="selo automatico">Treino do aluno</span>}
                <span className={`selo ${s.ativo ? 'aberto' : 'fechado'}`}>
                  {s.ativo ? 'Aberto' : 'Fechado'}
                </span>
                <button onClick={() => alternar(s)}>
                  {s.ativo ? 'Fechar' : 'Abrir'}
                </button>
                <Link className="botao" href={`/professor/relatorio/${s.id}`}>
                  Relatório
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
