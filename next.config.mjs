/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // As imagens das questoes sao servidas estaticamente de /public/q,
  // sem otimizacao, para nao estourar a cota de Image Optimization da Vercel.
  images: { unoptimized: true },
};

export default nextConfig;
