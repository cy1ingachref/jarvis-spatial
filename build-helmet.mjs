// build-helmet.mjs — procedural low-poly Iron Man helmet -> ./models/helmet.glb
// Run: node build-helmet.mjs
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'fs';

// --- minimal browser shims so GLTFExporter.parse works under Node ---
globalThis.self = globalThis;
globalThis.document = globalThis.document || {
  createElementNS: () => ({ getContext: () => ({}) }),
  createElement: () => ({ getContext: () => ({}) }),
};
if (typeof TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;

// FileReader shim (Node 22 has Blob + .arrayBuffer, but not FileReader)
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend && this.onloadend(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend && this.onloadend(); }); }
};

mkdirSync('./models', { recursive: true });

// ---------- materials ----------
const redMetal = new THREE.MeshStandardMaterial({ name: 'IronRed', color: 0xb41f1f, metalness: 0.85, roughness: 0.35 });
const goldMetal = new THREE.MeshStandardMaterial({ name: 'GoldTrim', color: 0xd9a441, metalness: 0.95, roughness: 0.3 });
const eyeMat = new THREE.MeshStandardMaterial({
  name: 'EyeGlow', color: 0x001318, emissive: new THREE.Color(0x00f0ff), emissiveIntensity: 3.0, metalness: 0.2, roughness: 0.4
});

function mesh(geo, mat, name) { const m = new THREE.Mesh(geo, mat); m.name = name; return m; }

const helmet = new THREE.Group();
helmet.name = 'IronManHelmet';

// forehead / crown dome
const crown = mesh(new THREE.SphereGeometry(1.25, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), redMetal, 'Crown');
crown.position.y = 0.35;
helmet.add(crown);

// upper-back skull shell
const skull = mesh(new THREE.SphereGeometry(1.2, 24, 16, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.5), redMetal, 'Skull');
skull.position.y = 0.2;
helmet.add(skull);

// faceplate (front lower mask)
const face = mesh(new THREE.CylinderGeometry(0.78, 1.05, 1.15, 20, 1, false, 0, Math.PI), redMetal, 'Faceplate');
face.rotation.z = Math.PI / 2;
face.rotation.y = Math.PI / 2;
face.position.set(0, -0.35, 0.42);
helmet.add(face);

// cheeks (gold trim)
const cheekL = mesh(new THREE.BoxGeometry(0.35, 0.55, 0.7), goldMetal, 'CheekL');
cheekL.position.set(-0.62, -0.4, 0.35); cheekL.rotation.z = 0.2;
const cheekR = cheekL.clone(); cheekR.name = 'CheekR'; cheekR.position.x = 0.62; cheekR.rotation.z = -0.2;
helmet.add(cheekL, cheekR);

// chin / jaw
const jaw = mesh(new THREE.BoxGeometry(1.0, 0.45, 0.9), goldMetal, 'Jaw');
jaw.position.set(0, -1.0, 0.25);
helmet.add(jaw);

// central face ridge (gold)
const ridge = mesh(new THREE.BoxGeometry(0.14, 0.9, 0.2), goldMetal, 'Ridge');
ridge.position.set(0, -0.1, 1.0);
helmet.add(ridge);

// glowing eye slits (emissive cyan)
function eye(side) {
  const e = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.12), eyeMat, side > 0 ? 'EyeR' : 'EyeL');
  e.position.set(side * 0.34, 0.02, 0.95);
  e.rotation.z = side * -0.18;
  e.rotation.y = side * -0.25;
  return e;
}
helmet.add(eye(-1), eye(1));

// top vent (gold)
const vent = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), goldMetal, 'Vent');
vent.position.set(0, 1.05, 0.1);
helmet.add(vent);

// ---------- normalize transform ----------
const box = new THREE.Box3().setFromObject(helmet);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const scale = 3.2 / Math.max(size.x, size.y, size.z);
helmet.scale.setScalar(scale);
helmet.position.sub(center.multiplyScalar(scale));
helmet.rotation.y = Math.PI; // face the camera

// ---------- export GLB ----------
const exporter = new GLTFExporter();
exporter.parse(
  helmet,
  (result) => {
    if (result instanceof ArrayBuffer) {
      writeFileSync('./models/helmet.glb', Buffer.from(result));
      console.log('OK helmet.glb bytes=' + result.byteLength);
    } else {
      console.error('ERROR: exporter did not return binary GLB');
      process.exit(1);
    }
  },
  (err) => { console.error('EXPORT ERROR', err); process.exit(1); },
  { binary: true, onlyVisible: true }
);
