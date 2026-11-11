// Recopie le design system Pyrite (dossier ../project) dans le site.
// - tokens.json  -> src/styles/generated/tokens.css (variables CSS, thèmes clair et sombre)
// - bundle.css   -> src/styles/generated/composants.css (sans l'import Google Fonts :
//   les polices sont servies par le site lui-même, voir src/styles/polices.css)
// Le design system reste la source de vérité : on ne modifie pas les fichiers générés à la main.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ici = dirname(fileURLToPath(import.meta.url));
const projet = join(ici, '..', '..', 'project');
const sortie = join(ici, '..', 'src', 'styles', 'generated');

// Sur Cloudflare, seul le dossier du site est disponible : on garde alors les fichiers déjà générés.
if (!existsSync(join(projet, 'tokens.json'))) {
  console.log('Design system introuvable (../project) : utilisation des styles déjà générés.');
  process.exit(0);
}
mkdirSync(sortie, { recursive: true });

const tokens = JSON.parse(readFileSync(join(projet, 'tokens.json'), 'utf8'));
const entete = '/* Fichier généré par scripts/sync-design-system.mjs à partir de project/. Ne pas modifier à la main. */\n';

// « {laiton} » devient « var(--laiton) »
const valeur = (v) => (typeof v === 'string' && v.startsWith('{') ? `var(--${v.slice(1, -1)})` : v);

const fixes = [];
const clair = [];
const sombre = [];
for (const t of tokens.color.tokens) {
  if (typeof t.value === 'object') {
    clair.push(`  --${t.name}: ${valeur(t.value.clair)};`);
    sombre.push(`  --${t.name}: ${valeur(t.value.sombre)};`);
  } else {
    fixes.push(`  --${t.name}: ${valeur(t.value)};`);
  }
}
const autres = [
  ...tokens.spacing.tokens.map((t) => `  --${t.name}: ${t.value};`),
  ...tokens.radius.tokens.map((t) => `  --${t.name}: ${t.value};`),
  ...tokens.trait.tokens.map((t) => `  --${t.name}: ${t.value};`),
  // Les polices auto-hébergées (Fontsource) portent le suffixe « Variable ».
  `  --font-display: "Fraunces Variable", ${tokens.type.families.display};`,
  `  --font-texte: "Public Sans Variable", ${tokens.type.families.texte};`,
  `  --font-mono: ${tokens.type.families.mono};`,
];

const css = `${entete}
:root {
${fixes.join('\n')}
${autres.join('\n')}
}

/* Thème clair : par défaut, et sur tout conteneur data-theme="clair". */
:root,
[data-theme="clair"] {
${clair.join('\n')}
}

/* Thème sombre : moments forts (appel final, Ultra), sur un conteneur data-theme="sombre". */
[data-theme="sombre"] {
${sombre.join('\n')}
}
`;
writeFileSync(join(sortie, 'tokens.css'), css);

const bundle = readFileSync(join(projet, 'components', 'bundle.css'), 'utf8')
  .replace(/^@import url\([^)]*\);\s*/m, '')
  // Le body du bundle sert aux aperçus du design system ; le site définit le sien.
  .replace(/^body \{[^}]*\}\s*/m, '');
writeFileSync(join(sortie, 'composants.css'), entete + bundle);

console.log(`Design system synchronisé : ${fixes.length + clair.length} couleurs, ${autres.length} autres variables.`);
