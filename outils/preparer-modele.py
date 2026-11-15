# Prépare le scan de pyrite pour le web (étape 1, avant simplification).
# Lit modele-source/ (jamais modifié) et écrit un GLB brut dans le dossier de sortie :
# - recentre l'objet sur l'origine, hauteur ramenée à 2 unités ;
# - demi-tour sur l'axe vertical : la face avec l'étiquette regarde la caméra (côté pyrite, z > 0),
#   la face avec la mire de couleur part derrière (côté or, z < 0, où la texture n'est pas affichée) ;
# - calcule les normales (lisses, pondérées par l'aire des triangles) ;
# - efface l'étiquette en papier et un morceau de mire sur une copie de la texture, réduite en WebP.
# Usage : python outils/preparer-modele.py <modele-source> <dossier-sortie> [taille-texture]
# Ensuite : npx @gltf-transform/cli simplify / meshopt (voir docs/decisions.md, 16/11/2026).
import io, json, struct, sys, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE, SORTIE = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
TAILLE = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
SORTIE.mkdir(parents=True, exist_ok=True)

# --- Lecture de l'OBJ (sommets, coordonnées de texture, triangles « v/vt ») ---
V, VT, F = [], [], []
with open(SOURCE / 'PYRITE.obj') as f:
    for l in f:
        k = l[:2]
        if k == 'v ': V.append(l[2:])
        elif k == 'vt': VT.append(l[3:])
        elif k == 'f ': F.append(l[2:].replace('/', ' '))
V = np.loadtxt(V); VT = np.loadtxt(VT); F = np.loadtxt(F, dtype=np.int64) - 1
fv, ft = F[:, [0, 2, 4]], F[:, [1, 3, 5]]

# --- Recentrage (centre de la boîte englobante) et échelle ---
centre = (V.min(0) + V.max(0)) / 2
P = (V - centre) / (V.max(0)[1] - V.min(0)[1]) * 2
P[:, 0] *= -1; P[:, 2] *= -1  # demi-tour autour de l'axe vertical (y)

# --- Normales par sommet de position : lisses même aux coutures de la texture ---
a, b, c = P[fv[:, 0]], P[fv[:, 1]], P[fv[:, 2]]
n = np.cross(b - a, c - a)
N = np.zeros_like(P)
for i in range(3): np.add.at(N, fv[:, i], n)
N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
if np.mean(np.sum(N * P, axis=1)) < 0:  # triangles dans l'autre sens : on retourne tout
    N = -N; fv = fv[:, ::-1]; ft = ft[:, ::-1]

# --- Un sommet GLB par paire (position, coordonnée de texture) ---
cle = fv.ravel() * len(VT) + ft.ravel()
uniques, inverse = np.unique(cle, return_inverse=True)
iv, it = uniques // len(VT), uniques % len(VT)
pos = P[iv].astype(np.float32); nor = N[iv].astype(np.float32)
uv = np.column_stack([VT[it, 0], 1 - VT[it, 1]]).astype(np.float32)  # glTF : origine en haut à gauche
idx = inverse.astype(np.uint32)

# --- Texture : copie réduite, étiquette et morceau de mire effacés par clonage ---
Image.MAX_IMAGE_PIXELS = None
tex = Image.open(SOURCE / 'PYRITE.jpg').convert('RGB').resize((2048, 2048), Image.LANCZOS)
# (zone à effacer en pixels sur 2048, décalage de la zone de roche copiée par-dessus)
retouches = [
    (lambda d: d.polygon([(612, 1372), (700, 1340), (850, 1405), (858, 1475), (790, 1490), (640, 1440)], fill=255), (0, -150)),
    (lambda d: d.polygon([(425, 1668), (520, 1660), (520, 1755), (425, 1755)], fill=255), (-110, 0)),
]
for dessiner, (dx, dy) in retouches:
    masque = Image.new('L', tex.size, 0); dessiner(ImageDraw.Draw(masque))
    masque = masque.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(6))
    tex = Image.composite(tex.transform(tex.size, Image.AFFINE, (1, 0, dx, 0, 1, dy)), tex, masque)
tex = tex.resize((TAILLE, TAILLE), Image.LANCZOS)
tampon = io.BytesIO(); tex.save(tampon, 'WEBP', quality=80, method=6); image = tampon.getvalue()
tex.save(SORTIE / 'texture-apercu.png')

# --- Écriture du GLB ---
blocs, vues, offset = [], [], 0
def ajouter(donnees, cible=None):
    global offset
    vue = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(donnees)}
    if cible: vue['target'] = cible
    vues.append(vue); blocs.append(donnees); offset += len(donnees)
    pad = (-offset) % 4; blocs.append(b'\0' * pad); offset += pad
    return len(vues) - 1
acc = [
    {'bufferView': ajouter(pos.tobytes(), 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
     'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
    {'bufferView': ajouter(nor.tobytes(), 34962), 'componentType': 5126, 'count': len(nor), 'type': 'VEC3'},
    {'bufferView': ajouter(uv.tobytes(), 34962), 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'},
    {'bufferView': ajouter(idx.tobytes(), 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
]
vue_image = ajouter(image)
gltf = {
    'asset': {'version': '2.0', 'generator': 'Pyrite preparer-modele.py'},
    'extensionsUsed': ['EXT_texture_webp'], 'extensionsRequired': ['EXT_texture_webp'],
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'pyrite'}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
    'materials': [{'name': 'pyrite', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 1, 'roughnessFactor': 0.5}}],
    'textures': [{'extensions': {'EXT_texture_webp': {'source': 0}}}],
    'images': [{'bufferView': vue_image, 'mimeType': 'image/webp'}],
    'accessors': acc, 'bufferViews': vues, 'buffers': [{'byteLength': offset}],
}
js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
binaire = b''.join(blocs)
with open(SORTIE / 'pyrite-brut.glb', 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binaire)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(binaire), 0x004E4942)); f.write(binaire)
print(f'sommets {len(pos)}, triangles {len(idx) // 3}, texture {TAILLE} px WebP {len(image) // 1024} Ko')
print('boîte', pos.min(0).round(3), pos.max(0).round(3))
