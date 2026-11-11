// Configuration du site Pyrite.
// Les pages publiques sont générées à l'avance (statiques) ; seules les pages
// d'administration de Keystatic (/keystatic) tournent côté serveur, sur Cloudflare.
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

// En développement local, on n'utilise pas le simulateur Cloudflare : l'éditeur Keystatic
// doit pouvoir écrire les fichiers de textes sur le disque, ce que le simulateur ne permet pas.
const enDeveloppement = process.argv.includes('dev');

export default defineConfig({
  output: 'static',
  adapter: enDeveloppement ? undefined : cloudflare(),
  integrations: [react(), markdoc(), keystatic()],
  trailingSlash: 'never',
});
