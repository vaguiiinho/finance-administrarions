#!/usr/bin/env node
// Copia web/lib -> mobile/src/lib para a lista de arquivos compartilhados (ADR 0011 10.3).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_FILES } from './shared-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const file of SHARED_FILES) {
  const from = resolve(root, 'web', 'lib', file);
  const to = resolve(root, 'mobile', 'src', 'lib', file);
  if (!existsSync(from)) {
    console.warn(`pulado (nao existe no web): ${file}`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copiado: ${file}`);
}
