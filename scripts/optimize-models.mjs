// Shrinks the GLBs exported from assets/source/hunter-models.blend for the Quest 3 browser:
// meshopt geometry, WebP textures capped per model. Geometry is never simplified here and the
// scene graph is kept, so named parts (pistol trigger, LEDs) stay addressable from code.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets/export';
const OUT = 'public/models';
/** Max texture side per model: the pistol is always at arm's length, creatures are 1–3 m away. */
const MODELS = { pistol: 2048, mutant: 1024, skull: 1024, orb: 1024, wingskull: 1024 };

mkdirSync(OUT, { recursive: true });
for (const [name, size] of Object.entries(MODELS)) {
  const input = join(SRC, `${name}.glb`);
  const output = join(OUT, `${name}.glb`);
  execFileSync('npx', [
    'gltf-transform', 'optimize', input, output,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(size),
    '--simplify', 'false',
    '--join', 'false',
    '--flatten', 'false',
    '--instance', 'false',
    '--palette', 'false',
  ], { stdio: 'inherit' });
  const mb = (bytes) => (bytes / 1048576).toFixed(1);
  console.log(`${name}: ${mb(statSync(input).size)} MB -> ${mb(statSync(output).size)} MB`);
}
