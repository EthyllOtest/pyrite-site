// Éditeur de textes Keystatic : définit ce qu'Ewan peut modifier depuis /keystatic.
// En ligne : les textes sont lus et enregistrés dans le dépôt GitHub (connexion avec le compte GitHub d'Ewan),
// et chaque enregistrement relance la construction du site sur Cloudflare.
// Sur l'ordinateur (npm run dev) : enregistrement direct dans les fichiers, sauf si PUBLIC_KEYSTATIC_GITHUB=oui
// (utile une seule fois, pour créer l'application GitHub de Keystatic).
// Règle commune : un texte laissé vide s'affiche sur le site comme un repère « À FOURNIR ».
import { config, fields, singleton } from '@keystatic/core';

const texte = (label: string, description?: string) => fields.text({ label, description });
const paragraphe = (label: string, description?: string) => fields.text({ label, description, multiline: true });
const titreEtTexte = (label: string) => fields.object({ titre: texte('Titre'), texte: paragraphe('Texte') }, { label });
const liste = (label: string, element: ReturnType<typeof fields.object>, champ = 'titre') =>
  fields.array(element, { label, itemLabel: (p: any) => p.fields[champ]?.value || label });
const meta = () => fields.object({ titre: texte('Titre de la page (onglet)'), description: paragraphe('Description pour Google et les partages') }, { label: 'Référencement' });
const final = () => fields.object({ titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Appel final' });
const faq = () => liste('Questions fréquentes', fields.object({ question: texte('Question'), reponse: paragraphe('Réponse', 'Laisser vide tant que la réponse n’est pas arrêtée') }, { label: 'Question' }), 'question');
const page = (label: string, fichier: string, schema: Record<string, any>) =>
  singleton({ label, path: `src/content/pages/${fichier}`, format: { data: 'yaml' }, schema });
const pageLegale = (label: string, fichier: string) => page(label, fichier, {
  meta: meta(),
  titre: texte('Titre'),
  miseAJour: texte('Date de dernière mise à jour'),
  sections: liste('Sections', fields.object({
    titre: texte('Titre de la section'),
    texte: paragraphe('Texte', 'Séparer les paragraphes par une ligne vide'),
    manque: texte('Ce qu’il faut fournir (affiché tant que le texte est vide)'),
  }, { label: 'Section' })),
});

const modeGitHub = import.meta.env.PROD || import.meta.env.PUBLIC_KEYSTATIC_GITHUB === 'oui';

export default config({
  storage: modeGitHub ? { kind: 'github', repo: 'EthyllOtest/pyrite-site' } : { kind: 'local' },
  ui: {
    brand: { name: 'Pyrite' },
    navigation: {
      'Pages': ['accueil', 'pageOffres', 'methode', 'aPropos', 'reserver', 'confirmation'],
      'Données communes': ['offres', 'parametres'],
      'Pages légales': ['mentions', 'confidentialite', 'cgv'],
    },
  },
  singletons: {
    accueil: page('Accueil', 'accueil', {
      meta: meta(),
      ouverture: fields.object({ label: texte('Surtitre'), titre: texte('Titre principal'), texte: paragraphe('Texte'), mention: texte('Mention sous le bouton', 'Par exemple : 30 minutes · 29 €') }, { label: 'Premier écran' }),
      constat: fields.object({ titre: texte('Titre'), texte: paragraphe('Texte'), points: liste('Constats', titreEtTexte('Constat')) }, { label: 'Constat' }),
      methode: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), or: titreEtTexte('Verdict Or'), pyrite: titreEtTexte('Verdict Pyrite'), criteres: paragraphe('Phrase sur les critères') }, { label: 'Or ou pyrite' }),
      deroule: fields.object({ titre: texte('Titre'), etapes: liste('Étapes', titreEtTexte('Étape')) }, { label: 'Comment ça se passe' }),
      offres: fields.object({ titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Les offres (introduction)' }),
      accompagnement: fields.object({
        label: texte('Surtitre'), titre: texte('Titre'),
        portrait: fields.image({ label: 'Portrait (utilisé aussi sur la page À propos)', directory: 'public/images', publicPath: '/images/' }),
        portraitAlt: texte('Description du portrait (texte alternatif)'),
        parcours: paragraphe('Votre parcours', '3 ou 4 lignes, en faits vérifiables'),
        realisation: paragraphe('Votre réalisation chez AXA', 'En chiffres vérifiables, sans logo'),
      }, { label: 'Qui vous accompagne' }),
      retours: liste('Premiers retours (section masquée tant qu’elle est vide ; utilisés aussi sur À propos)', fields.object({ citation: paragraphe('Citation'), prenom: texte('Prénom'), fonction: texte('Fonction') }, { label: 'Retour' }), 'prenom'),
      final: final(),
    }),
    pageOffres: page('Offres', 'page-offres', {
      meta: meta(),
      intro: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Introduction' }),
      details: liste('Détail de chaque offre', fields.object({
        reference: texte('Référence', 'Doit correspondre au catalogue : PYR-00 à PYR-03, PYR-MIS'),
        blocs: liste('Blocs', fields.object({ titre: texte('Intertitre'), texte: paragraphe('Texte'), manque: texte('Ce qu’il faut fournir (affiché tant que le texte est vide)') }, { label: 'Bloc' })),
      }, { label: 'Offre' }), 'reference'),
      employeur: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), conditions: paragraphe('Conditions de facturation') }, { label: 'Si votre employeur finance' }),
      faq: faq(),
      final: final(),
    }),
    methode: page('Méthode', 'methode', {
      meta: meta(),
      intro: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Introduction' }),
      pourquoi: titreEtTexte('Pourquoi'),
      grille: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), or: titreEtTexte('Verdict Or'), pyrite: titreEtTexte('Verdict Pyrite'), criteres: liste('Critères', titreEtTexte('Critère')) }, { label: 'Grille or / pyrite' }),
      quatreD: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), etapes: liste('Étapes (ordre fixe)', fields.object({ nom: texte('Nom'), texte: paragraphe('Texte') }, { label: 'Étape' }), 'nom') }, { label: 'Méthode 4D' }),
      engagements: fields.object({ titre: texte('Titre'), points: liste('Engagements', titreEtTexte('Engagement')) }, { label: 'Ce que Pyrite ne fait pas' }),
      donnees: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Vos données' }),
      final: final(),
    }),
    aPropos: page('À propos', 'a-propos', {
      meta: meta(),
      intro: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), presentation: paragraphe('Présentation', '2 ou 3 phrases : qui vous êtes, ce que vous faites, pour qui') }, { label: 'Introduction' }),
      parcours: fields.object({ titre: texte('Titre'), etapes: liste('Étapes', fields.object({ dates: texte('Dates'), texte: paragraphe('Texte') }, { label: 'Étape' }), 'dates') }, { label: 'Parcours' }),
      realisation: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), chiffres: liste('Chiffres clés', fields.object({ valeur: texte('Chiffre'), libelle: texte('Libellé') }, { label: 'Chiffre' }), 'valeur') }, { label: 'Réalisation chez AXA' }),
      nom: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte') }, { label: 'Pourquoi « Pyrite »' }),
      final: final(),
    }),
    reserver: page('Réserver', 'reserver', {
      meta: meta(),
      intro: fields.object({ label: texte('Surtitre'), titre: texte('Titre'), texte: paragraphe('Texte'), suite: texte('Phrase sur la suite') }, { label: 'Introduction' }),
      deroule: fields.object({ titre: texte('Titre'), etapes: liste('Étapes', titreEtTexte('Étape')) }, { label: 'Pendant les 30 minutes' }),
      avant: fields.object({ titre: texte('Titre'), texte: paragraphe('Texte'), formulaire: paragraphe('Questions du formulaire', '3 ou 5 questions') }, { label: "Avant l'appel" }),
      reservation: fields.object({ titre: texte('Titre'), texte: paragraphe('Texte'), mentions: paragraphe('Mentions légales sous le calendrier') }, { label: 'Réservation' }),
      faq: faq(),
    }),
    confirmation: page('Confirmation', 'confirmation', {
      meta: meta(),
      message: texte('Message « Confirmé »'),
      titre: texte('Titre'),
      email: paragraphe("Ce que contient l'e-mail de confirmation"),
      preparation: paragraphe("Conseil pour préparer l'appel"),
    }),
    offres: page('Catalogue des offres', 'offres', {
      forfaits: fields.array(fields.object({
        reference: texte('Référence', 'PYR-00 à PYR-03'), nom: texte('Nom'),
        prix: texte('Prix', 'Laisser vide pour afficher « Prix à confirmer »'), duree: texte('Durée'),
        resume: paragraphe('Résumé (carte)'), ancre: texte('Ancre dans la page Offres', 'Par exemple : essentiel'),
        sombre: fields.checkbox({ label: 'Carte sombre (Ultra uniquement)' }),
      }, { label: 'Offre' }), { label: 'Offres', itemLabel: (p) => `${p.fields.reference.value} · ${p.fields.nom.value}` }),
      surDevis: fields.object({ reference: texte('Référence'), nom: texte('Nom'), prix: texte('Prix'), resume: paragraphe('Résumé'), ancre: texte('Ancre') }, { label: 'Missions sur devis' }),
    }),
    parametres: page('Coordonnées et informations', 'parametres', {
      email: texte('E-mail de contact'),
      linkedin: fields.url({ label: 'Profil LinkedIn' }),
      siret: texte('SIRET'),
      formatAppel: texte("Format de l'appel initial", 'Visio ou téléphone'),
      calendly: fields.url({ label: 'Lien de la page Calendly', description: 'Par exemple https://calendly.com/votre-nom/appel-initial' }),
      referencement: fields.checkbox({
        label: 'Site visible par Google',
        description: "À cocher le jour du lancement, une fois les contenus « À FOURNIR » remplis. Décoché, les moteurs de recherche sont priés de ne pas référencer le site.",
        defaultValue: false,
      }),
    }),
    mentions: pageLegale('Mentions légales', 'mentions-legales'),
    confidentialite: pageLegale('Politique de confidentialité', 'confidentialite'),
    cgv: pageLegale('Conditions générales de vente', 'cgv'),
  },
});
