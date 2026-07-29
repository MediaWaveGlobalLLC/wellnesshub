#!/usr/bin/env node
import process from 'node:process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload = {};
try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }

const input = payload.tool_input ?? payload.input ?? {};
const target = String(input.file_path ?? input.path ?? input.filename ?? '').replaceAll('\\', '/');
const protectedPatterns = [
  /(^|\/)design-references\//,
  /(^|\/)brand-reference\//,
  /(^|\/)public\/brand\/originals\//,
  /(^|\/)config\/design-tokens\.json$/,
  /(^|\/)CLAUDE\.md$/,
];

if (protectedPatterns.some((pattern) => pattern.test(target))) {
  console.error(`BLOCKED: ${target} is a protected design-contract file. Ask the user for explicit approval before changing it.`);
  process.exit(2);
}

process.exit(0);
