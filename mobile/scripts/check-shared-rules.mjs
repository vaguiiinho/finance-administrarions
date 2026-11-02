#!/usr/bin/env node
// Falha (exit 1) se alguma regra pura copiada do web divergir de web/lib (ADR 0011 10.3, CI do mobile e do web).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_FILES } from './shared-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const webLib = resolve(root, 'web', 'lib');
const mobileLib = resolve(root, 'mobile', 'src', 'lib');

const problems = [];
for (const file of SHARED_FILES) {
  const web = resolve(webLib, file);
  const mobile = resolve(mobileLib, file);
  if (!existsSync(web)) problems.push(`ausente no web:    web/lib/${file}`);
  else if (!existsSync(mobile)) problems.push(`ausente no mobile: mobile/src/lib/${file}`);
  else if (!readFileSync(web).equals(readFileSync(mobile))) problems.push(`divergente:        ${file}`);
}

if (problems.length > 0) {
  console.error('Regras compartilhadas fora de sincronia (fonte da verdade: web/lib). Rode `npm run sync:shared` no mobile.');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`OK: ${SHARED_FILES.length} arquivos identicos em web/lib e mobile/src/lib.`);
