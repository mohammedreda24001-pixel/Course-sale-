import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function resolvesModule(base) {
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].map(extension => `${base}${extension}`),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs'].map(file => join(base, file)),
  ];
  return candidates.some(candidate => existsSync(candidate));
}

const sourceFiles = walk(sourceRoot).filter(file => sourceExtensions.has(extname(file)));
const failures = [];
const importPattern = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
const forbidden = [
  ['basePrice', /\bbasePrice\b/],
  ['deliveryFee', /\bdeliveryFee\b/],
  ['totalPrice', /\btotalPrice\b/],
  ['ShipmentTrackingCode', /\bShipmentTrackingCode\b/],
  ['legacy Waseet tracking field', /\bwaseet_tracking_number\b/],
  ['legacy Waseet sticker field', /\bwaseet_sticker_url\b/],
  ['legacy Waseet sync field', /\bwaseet_sync_status\b/],
  ['removed shipping module', /modules\/shipping\/(?:iraq-provinces|prepare-order)/],
  ['removed legacy order normalizer', /modules\/orders\/normalize-order-input/],
];

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: contains ${label}`);
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const base = specifier.startsWith('@/')
      ? join(sourceRoot, specifier.slice(2))
      : resolve(dirname(file), specifier);
    if (!resolvesModule(base)) failures.push(`${file}: unresolved import ${specifier}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const packageLock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'));
const lockRoot = packageLock.packages?.[''];
if (!lockRoot) failures.push('package-lock.json has no root package entry');
else {
  for (const key of ['dependencies', 'devDependencies']) {
    const manifest = JSON.stringify(packageJson[key] || {});
    const locked = JSON.stringify(lockRoot[key] || {});
    if (manifest !== locked) failures.push(`package-lock root ${key} does not match package.json`);
  }
}

if (failures.length > 0) {
  console.error('Static source validation failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Static source validation passed (${sourceFiles.length} source files).`);
