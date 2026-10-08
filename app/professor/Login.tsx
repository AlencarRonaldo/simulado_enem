'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function Login() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch('/api/professor/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (!r.ok) {
        setErro((await r.json()).erro ?? 'Senha incorreta.');
        setEnviando(false);
        return;
      }
      router.refresh();
    } catch {
      setErro('Sem conexão.');
      setEnviando(false);
    }
  }

  return (
    <form className="folha-papel cartao" onSubmit={entrar}>
      <label className="campo">
        <span>Senha</span>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
      </label>
      {erro && <div className="aviso">{erro}</div>}
      <button type="submit" className="botao-principal" style={{ width: '100%', marginTop: '.75rem' }} disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
