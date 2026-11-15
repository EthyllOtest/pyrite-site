// Cristal 3D de la section « Or ou pyrite » (Three.js), chargé seulement quand la section approche.
// Un cube unique dont la matière glisse de la pyrite (striée, terne) à l'or (lisse, chaude) selon une
// progression de 0 à 1 fournie par le défilement. Aucune image ni modèle externe : tout est généré ici.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, MeshPhysicalMaterial, Mesh, Color,
  CanvasTexture, RepeatWrapping, PMREMGenerator, DirectionalLight, NeutralToneMapping, Vector2,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Couleur lue dans les variables du design system (aucune valeur en dur).
const variable = (el, nom) => new Color(getComputedStyle(el).getPropertyValue(nom).trim());

// Stries de la pyrite : relief en fines crêtes parallèles, d'épaisseurs irrégulières, sous forme de carte de normales.
function texteDesStries() {
  const taille = 256;
  const toile = document.createElement('canvas');
  toile.width = toile.height = taille;
  const ctx = toile.getContext('2d');
  const image = ctx.createImageData(taille, taille);
  for (let y = 0; y < taille; y++) {
    const a = (2 * Math.PI * y) / taille;
    // Pente du relief : trois ondes de fréquences entières, pour que le motif se répète sans couture.
    const pente = 4.5 * Math.cos(9 * a) + 6.9 * Math.cos(23 * a + 1.3) + 6.2 * Math.cos(41 * a + 0.4);
    let ny = -pente * 0.05;
    let nz = 1;
    const longueur = Math.hypot(ny, nz);
    ny /= longueur; nz /= longueur;
    for (let x = 0; x < taille; x++) {
      const i = (y * taille + x) * 4;
      image.data[i] = 128;
      image.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      image.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(toile);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

const lisser = (p) => p * p * (3 - 2 * p);

/**
 * Crée le cristal dans `conteneur`. Renvoie null si WebGL n'est pas disponible (l'image fixe reste alors affichée).
 * @param {HTMLElement} conteneur
 */
export function demarrer(conteneur) {
  let rendu;
  try {
    rendu = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  if (!rendu.getContext()) return null;

  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendu.toneMapping = NeutralToneMapping;
  rendu.setClearColor(0x000000, 0);
  const toile = rendu.domElement;
  toile.setAttribute('aria-hidden', 'true');
  toile.className = 'cristal__toile';
  conteneur.appendChild(toile);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const lumiere = new DirectionalLight(variable(conteneur, '--reflet'), 1.4);
  lumiere.position.set(2, 3, 2.5);
  scene.add(lumiere);

  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 3.9);

  // Pyrite : un laiton terne, tiré vers le gris-vert du minéral. Or : le laiton de la marque.
  const pyrite = variable(conteneur, '--ombre').lerp(variable(conteneur, '--pyrite'), 0.45);
  const or = variable(conteneur, '--or');

  const geometrie = new BoxGeometry(1, 1, 1);
  // Comme sur un vrai cube de pyrite, les stries de deux faces voisines sont perpendiculaires :
  // on fait pivoter les coordonnées de texture des faces latérales droite et gauche.
  const uv = geometrie.attributes.uv;
  for (let i = 0; i < 8; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); }

  const matiere = new MeshPhysicalMaterial({
    color: pyrite.clone(),
    metalness: 1,
    roughness: 0.55,
    normalMap: texteDesStries(),
    normalScale: new Vector2(1.1, 1.1),
    clearcoat: 0,
    clearcoatRoughness: 0.08,
  });
  const cube = new Mesh(geometrie, matiere);
  scene.add(cube);

  let progression = 0;
  const dessiner = () => {
    const e = lisser(progression);
    matiere.color.lerpColors(pyrite, or, e);
    matiere.roughness = 0.55 + (0.12 - 0.55) * e;
    matiere.normalScale.setScalar(1.1 * (1 - e));
    matiere.clearcoat = 0.6 * e;
    matiere.envMapIntensity = 0.7 + 0.6 * e;
    // Légère rotation liée au défilement : un quart de tour sur toute la section.
    cube.rotation.set(0.5 + 0.08 * progression, -0.75 + progression * (Math.PI / 2), 0);
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
  new ResizeObserver(ajuster).observe(conteneur);
  ajuster();

  return {
    /** @param {number} p progression de 0 (pyrite) à 1 (or) */
    rendre(p) {
      const suivante = Math.min(1, Math.max(0, p));
      if (suivante === progression && toile.width) return;
      progression = suivante;
      dessiner();
    },
  };
}
