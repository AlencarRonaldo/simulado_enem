import type { Metadata, Viewport } from 'next';

// Fontes auto-hospedadas (pacotes npm), de proposito, em vez de next/font/google:
//  - o build nao depende de alcancar fonts.googleapis.com, que rede de escola
//    e proxy corporativo costumam bloquear;
//  - o navegador do aluno nao faz requisicao a terceiros;
//  - sao variaveis e subdivididas por unicode-range, entao em portugues o
//    download real e so o subset latino (~85 KB no total).
//
// Source Serif 4: desenhada para leitura de texto corrido em tela — os textos
// de apoio do ENEM sao longos e e nisso que o aluno passa a prova inteira.
// Archivo: grotesca institucional, para cronometro, numeros e folha de respostas.
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/archivo';

import './globals.css';

export const metadata: Metadata = {
  title: 'Simulado ENEM',
  description: 'Simulado do ENEM com questões das provas oficiais de 2015 a 2023.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
