'use client';

import { useRouter } from 'next/navigation';

export function Sair() {
  const router = useRouter();
  async function sair() {
    await fetch('/api/professor/login', { method: 'DELETE' });
    router.refresh();
  }
  return <button onClick={sair}>Sair</button>;
}
