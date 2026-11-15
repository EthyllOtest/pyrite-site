// Pyrite 3D de la section « Or ou pyrite » (Three.js), chargée seulement quand la section approche.
// Modèle : scan de pyrite préparé par outils/preparer-modele.py (public/modeles/pyrite.glb).
// L'objet a deux moitiés, séparées par un plan vertical passant par son centre :
// devant la pyrite du scan, derrière de l'or lisse généré ici, avec le relief du scan.
// Le défilement fait faire un demi-tour à l'objet (progression 0 → 1) ; quand la ligne de séparation
// passe face à l'écran, un reflet balaie l'objet.
import {
  WebGLRenderer, Scene, PerspectiveCamera, MeshPhysicalMaterial, Color, PMREMGenerator,
  DirectionalLight, NeutralToneMapping, Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Couleur lue dans les variables du design system (aucune valeur en dur).
const variable = (el, nom) => new Color(getComputedStyle(el).getPropertyValue(nom).trim());

// Réglages de la matière et du mouvement.
const LARGEUR_TRANSITION = 0.012; // demi-largeur de la ligne pyrite / or, en unités de l'objet (profondeur ≈ 1,2)
const RUGOSITE_PYRITE = 0.42;
const RUGOSITE_OR = 0.16;
const INCLINAISON = 0.12; // l'objet penche légèrement vers l'avant, pour qu'on voie un peu son dessus
// Orientation du plan vertical de séparation (autour de l'axe vertical, passant par le centre) : choisie pour suivre
// au mieux le contour de la pierre, afin qu'aucun liseré de l'autre matière ne dépasse de face ou de dos.
const ANGLE_SEPARATION = (34 * Math.PI) / 180;

/**
 * Crée la pyrite 3D dans `conteneur`.
 * Renvoie null si WebGL n'est pas disponible (l'image fixe reste alors affichée) ;
 * lève une erreur si le modèle ne se charge pas (l'appelant garde aussi l'image fixe).
 * @param {HTMLElement} conteneur
 * @param {string} adresseModele
 */
export async function demarrer(conteneur, adresseModele) {
  let rendu;
  try {
    rendu = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  if (!rendu.getContext()) return null;

  let gltf;
  try {
    const chargeur = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    gltf = await chargeur.loadAsync(adresseModele);
  } catch (erreur) {
    rendu.dispose();
    throw erreur;
  }

  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendu.toneMapping = NeutralToneMapping;
  rendu.setClearColor(0x000000, 0);
  const toile = rendu.domElement;
  toile.setAttribute('aria-hidden', 'true');
  toile.className = 'cristal__toile';

  const scene = new Scene();
  const pmrem = new PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const reflet = variable(conteneur, '--reflet');
  const lumiere = new DirectionalLight(reflet, 1.3);
  lumiere.position.set(2, 3, 2.5);
  scene.add(lumiere);

  const camera = new PerspectiveCamera(22, 1, 0.1, 20);
  camera.position.set(0, 0, 6.1);

  // Valeurs partagées avec le shader : couleur de l'or, reflet et sa position.
  const reglages = {
    uOr: { value: variable(conteneur, '--or').lerp(reflet, 0.25) },
    uNormale: { value: new Vector3(Math.sin(ANGLE_SEPARATION), 0, Math.cos(ANGLE_SEPARATION)) },
    uReflet: { value: reflet },
    uLargeur: { value: LARGEUR_TRANSITION },
    uRugositeOr: { value: RUGOSITE_OR },
    uBalayage: { value: -9 },
    uEclat: { value: 0 },
  };

  const objet = gltf.scene;
  objet.traverse((enfant) => {
    if (!enfant.isMesh) return;
    const carte = enfant.material.map;
    // Pyrite : la texture du scan, légèrement teintée de laiton (« l'or des fous »).
    const matiere = new MeshPhysicalMaterial({
      map: carte, color: new Color(1, 1, 1).lerp(reflet, 0.3), metalness: 0.9, roughness: RUGOSITE_PYRITE,
    });
    // On complète le shader standard de Three.js : chaque pixel sait de quel côté du plan de séparation il se trouve.
    matiere.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, reglages);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPosObjet;\nvarying vec3 vPosMonde;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvPosObjet = transformed;\nvPosMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vPosObjet;
varying vec3 vPosMonde;
uniform vec3 uOr;
uniform vec3 uNormale;
uniform vec3 uReflet;
uniform float uLargeur;
uniform float uRugositeOr;
uniform float uBalayage;
uniform float uEclat;`)
        // Côté or (derrière le plan de séparation) : couleur or unie, la texture du scan disparaît ; transition courte.
        .replace('#include <map_fragment>', `#include <map_fragment>
float partOr = smoothstep(uLargeur, -uLargeur, dot(vPosObjet, uNormale));
diffuseColor.rgb = mix(diffuseColor.rgb, uOr, partOr);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uRugositeOr, partOr);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, partOr);')
        // Reflet : une bande oblique de lumière qui traverse l'objet, plus vive sur les faces tournées vers nous.
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float ecartBande = vPosMonde.x + 0.45 * vPosMonde.y - uBalayage;
float face = max(dot(normal, normalize(vViewPosition)), 0.0);
totalEmissiveRadiance += uReflet * uEclat * exp(-ecartBande * ecartBande / 0.008) * (0.3 + 0.7 * face * face);`);
    };
    enfant.material = matiere;
  });
  scene.add(objet);

  let progression = 0;
  const dessiner = () => {
    // Demi-tour : pyrite de face au début, or de face à la fin, dans les deux sens.
    objet.rotation.set(INCLINAISON, progression * Math.PI - ANGLE_SEPARATION, 0);
    // Le reflet traverse l'objet de gauche à droite entre 38 % et 62 % de la progression (ligne de face à 50 %).
    const t = (progression - 0.38) / 0.24;
    reglages.uBalayage.value = -1.7 + 3.4 * t;
    reglages.uEclat.value = t > 0 && t < 1 ? 1.8 * Math.sin(Math.PI * t) : 0;
    rendu.render(scene, camera);
  };

  const ajuster = () => {
    const largeur = conteneur.clientWidth;
    const hauteur = conteneur.clientHeight;
    if (!largeur || !hauteur) return;
    rendu.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    dessiner();
  };
  conteneur.appendChild(toile);
  new ResizeObserver(ajuster).observe(conteneur);
  ajuster();

  return {
    toile,
    /** @param {number} p progression de 0 (face pyrite) à 1 (face or) */
    rendre(p) {
      const suivante = Math.min(1, Math.max(0, p));
      if (suivante === progression && toile.width) return;
      progression = suivante;
      dessiner();
    },
  };
}
