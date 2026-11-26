/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export statique : Cloudflare Pages sert le dossier `out/`
  output: 'export',
  // L'optimisation d'images Next nécessite un serveur : désactivée en export statique
  images: { unoptimized: true },
  // URLs propres compatibles hébergement statique (/about/ → about/index.html)
  trailingSlash: true,
  reactStrictMode: true,
};

module.exports = nextConfig;
