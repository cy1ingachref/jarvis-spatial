// verify-glb.mjs — confirm models/helmet.glb is a valid binary glTF.
import { readFileSync } from 'fs';
const b = readFileSync('models/helmet.glb');
if (b.slice(0, 4).toString() !== 'glTF') { console.log('FAIL: not glTF'); process.exit(1); }
const jsonLen = b.readUInt32LE(12);            // JSON chunk length (uint32 at offset 12)
const jsonChunkType = b.readUInt32LE(16);      // should be 0x4E4F534A = 'JSON'
const json = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
const binLen = b.readUInt32LE(20 + jsonLen);   // BIN chunk length
const ok =
  jsonLen > 0 &&
  jsonChunkType === 0x4E4F534A &&
  json.meshes?.length >= 8 &&
  json.materials?.map(m => m.name).includes('IronRed') &&
  json.materials?.map(m => m.name).includes('GoldTrim') &&
  json.materials?.some(m => m.name === 'EyeGlow' && m.emissiveFactor) &&
  !!json.nodes?.find(n => n.name === 'IronManHelmet') &&
  binLen > 0;
console.log('JSON chunk len   :', jsonLen);
console.log('BIN  chunk len   :', binLen);
console.log('meshes           :', json.meshes.length);
console.log('materials        :', json.materials.map(m => m.name).join(', '));
console.log('EyeGlow emissive :', JSON.stringify(json.materials.find(m => m.name === 'EyeGlow').emissiveFactor));
console.log('total GLB bytes  :', b.length);
console.log(ok ? 'RESULT: VALID GLB ✓' : 'RESULT: FAIL');
process.exit(ok ? 0 : 1);
