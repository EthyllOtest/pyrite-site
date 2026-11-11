// Les textes du site sont des fichiers YAML dans src/content/pages, modifiables avec Keystatic (/keystatic).
// Chaque fichier devient une entrée : accueil, offres, parametres…
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/pages' }),
});

export const collections = { pages };
