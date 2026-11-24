import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDirectory = new URL('../dist/', import.meta.url).pathname;
const assetsDirectory = join(distDirectory, 'assets');
const limits = {
  // Everything the application can load: the entry, its static imports, and the chunks its own
  // source loads with import(), such as route pages.
  applicationJavaScriptGzip: 300 * 1024,
  // Chunks only a dependency's own import() can reach, fetched when that library opts into a
  // feature at runtime (for example ui-sdk's touch-sheet presentation). Bounded separately so a
  // dependency cannot grow them unnoticed.
  optionalLibraryJavaScriptGzip: 20 * 1024,
  largestJavaScriptChunkGzip: 180 * 1024,
  totalCssGzip: 50 * 1024,
};

async function filesWithin(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const details = await stat(path);
    if (details.isDirectory()) {
      files.push(...(await filesWithin(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

async function compressedBytes(path) {
  return gzipSync(await readFile(path), { level: 9 }).byteLength;
}

const manifest = JSON.parse(await readFile(join(distDirectory, '.vite/manifest.json'), 'utf8'));
const isDependency = (key) => key.includes('node_modules/');

// Walk from the entries through static imports and through lazy chunks of the application's own
// source, such as route pages. A lazy chunk whose module is a dependency's file (a library's own
// import(), or the application lazily importing a package) is optional library code instead.
const applicationKeys = new Set();
function visit(key) {
  if (applicationKeys.has(key) || !manifest[key]) {
    return;
  }
  applicationKeys.add(key);
  for (const imported of manifest[key].imports ?? []) {
    visit(imported);
  }
  for (const imported of manifest[key].dynamicImports ?? []) {
    if (!isDependency(imported)) {
      visit(imported);
    }
  }
}
for (const [key, chunk] of Object.entries(manifest)) {
  if (chunk.isEntry) {
    visit(key);
  }
}
const applicationFiles = new Set(
  [...applicationKeys].map((key) => join(distDirectory, manifest[key].file)),
);

const assets = await filesWithin(assetsDirectory);
const javascript = assets.filter((path) => path.endsWith('.js'));
const stylesheets = assets.filter((path) => path.endsWith('.css'));
const javascriptSizes = new Map(
  await Promise.all(javascript.map(async (path) => [path, await compressedBytes(path)])),
);
const stylesheetSizes = await Promise.all(stylesheets.map(compressedBytes));

const sum = (values) => values.reduce((total, size) => total + size, 0);
const optionalLibraryChunks = javascript.filter((path) => !applicationFiles.has(path));
const applicationJavaScriptGzip = sum(
  javascript.filter((path) => applicationFiles.has(path)).map((path) => javascriptSizes.get(path)),
);
const optionalLibraryJavaScriptGzip = sum(
  optionalLibraryChunks.map((path) => javascriptSizes.get(path)),
);
const largestJavaScriptChunkGzip = Math.max(0, ...javascriptSizes.values());
const totalCssGzip = sum(stylesheetSizes);

const measurements = {
  applicationJavaScriptGzip,
  optionalLibraryJavaScriptGzip,
  largestJavaScriptChunkGzip,
  totalCssGzip,
};
const failures = Object.entries(measurements).filter(([name, value]) => value > limits[name]);

if (failures.length > 0) {
  for (const [name, value] of failures) {
    console.error(`${name}: ${value} bytes exceeds ${limits[name]} bytes`);
  }
  process.exit(1);
}

console.log(
  [
    `SPA bundle budget passed (${javascript.length} JS chunks, ${stylesheets.length} CSS chunks)`,
    `application JS gzip ${applicationJavaScriptGzip} B`,
    `optional library JS gzip ${optionalLibraryJavaScriptGzip} B (${optionalLibraryChunks.length} chunks)`,
    `largest JS gzip ${largestJavaScriptChunkGzip} B`,
    `CSS total gzip ${totalCssGzip} B`,
  ].join('; '),
);
