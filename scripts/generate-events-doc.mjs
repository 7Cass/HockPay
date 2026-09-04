#!/usr/bin/env node
/**
 * Reescreve docs/EVENTS.md a partir do catalogo em @hockpay/core.
 *
 * O doc e artefato: a fonte e EVENT_CATALOG mais EVENT_EXAMPLES. Um teste em
 * core compara os dois, entao esquecer de rodar isto depois de mexer no
 * catalogo derruba a CI em vez de deixar a doc mentir.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderEventCatalogMarkdown } = require('@hockpay/core');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(repoRoot, 'docs/EVENTS.md');

writeFileSync(target, renderEventCatalogMarkdown(), 'utf8');
console.log(`[docs:events] wrote ${target}`);
