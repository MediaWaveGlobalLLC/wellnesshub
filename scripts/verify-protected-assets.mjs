#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'config', 'protected-assets.sha256.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

for (const [rel, expected] of Object.entries(manifest)) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { errors.push(`missing ${rel}`); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if (actual !== expected) errors.push(`modified ${rel}`);
}

if (errors.length) {
  console.error('Protected SIEMBRA references changed:');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}
console.log('Protected SIEMBRA assets verified.');
