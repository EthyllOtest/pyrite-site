// Espace insécable avant « € » et « min » : un prix ne se coupe jamais (règle du design system).
export const insecable = (s: string | undefined | null) =>
  typeof s === 'string' ? s.replace(/ (€|min\b)/g, ' $1') : s;

// Vrai si le champ est rempli (Keystatic enregistre une chaîne vide quand rien n'est saisi).
export const rempli = (s: unknown) => typeof s === 'string' && s.trim().length > 0;
