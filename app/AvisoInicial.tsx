'use client';

import { useState } from 'react';

/**
 * Aviso que aparece a cada visita na entrada do aluno: para que o sistema
 * existe e de quem e a iniciativa. Sem localStorage — o professor pediu que
 * apareca toda vez que a pagina abrir.
 */
export function AvisoInicial() {
  const [aberto, setAberto] = useState(true);
  if (!aberto) return null;

  return (
    /* Fundo fecha ao clicar fora; o modal em si nao deixa o clique passar. */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="modal-fundo" onClick={() => setAberto(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sobre o sistema"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          className="modal-logo"
          src="/brasao-ayrton-senna.png"
          alt="Brasão da E.E. Ayrton Senna da Silva"
        />
        <h2 className="modal-titulo">
          Provão Paulista<br />e ENEM
        </h2>
        <p className="modal-texto">
          Este sistema foi feito para auxiliar no estudo e na preparação para o
          Provão Paulista e o ENEM. Iniciativa da{' '}
          <strong>E.E. Ayrton Senna da Silva</strong>.
        </p>
        <button className="botao-principal" onClick={() => setAberto(false)}>
          Começar
        </button>
      </div>
    </div>
  );
}
