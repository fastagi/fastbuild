// Web theme contrast guard.
//
// Resolves the design tokens the way the browser cascades them: every stylesheet imported by
// src/themes/index.css, in order, where :root applies in both modes and .dark only in dark mode.
// Readable text/surface pairs must meet WCAG AA 4.5:1 and focus rings 3:1 in light and dark mode.
// When the repository registry is present, every registry theme's Web preset is also layered on the
// core tokens and checked, so a theme plugin cannot ship unreadable pairs or leak light values into
// dark mode.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { converter, parse, wcagContrast } from 'culori';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themeRoot = join(webRoot, 'src/themes');
const presetRoot = join(themeRoot, 'presets');
const sourceRoot = join(webRoot, 'src');
const registryPlugins = resolve(webRoot, '../registry/plugins');
const minimumTextContrast = 4.5;

const checks = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['text-main', 'bg-canvas'],
  ['text-main', 'bg-surface'],
  ['text-subtle', 'bg-canvas'],
  ['text-subtle', 'bg-surface'],
  ['text-muted', 'bg-canvas'],
  ['text-muted', 'bg-surface'],
  ['text-muted', 'bg-subtle'],
  ['muted-foreground', 'muted'],
  ['error', 'bg-canvas'],
  ['error', 'bg-surface'],
  ['error', 'bg-subtle'],
  ['success', 'bg-canvas'],
  ['success', 'bg-surface'],
  ['success', 'bg-subtle'],
  ['warning', 'bg-canvas'],
  ['warning', 'bg-surface'],
  ['warning', 'bg-subtle'],
  ['info', 'bg-canvas'],
  ['info', 'bg-surface'],
  ['info', 'bg-subtle'],
  ['destructive-foreground', 'destructive'],
  ['primary', 'bg-canvas'],
  ['primary-deeper', 'bg-canvas'],
  ['brand-panel-foreground', 'brand-panel'],
  ['brand-panel-foreground', 'brand-panel-deep'],
  ['brand-panel-action-foreground', 'brand-panel-action'],
];

// Text drawn at reduced opacity on a surface that also carries a translucent wash of the same
// foreground, as the brand panels do. The blended result must still meet the text minimum.
const blendedChecks = [
  // Panel copy over the blurred glow orb.
  { foreground: 'brand-panel-foreground', textAlpha: 0.85, washAlpha: 0.1, background: 'brand-panel' },
  { foreground: 'brand-panel-foreground', textAlpha: 0.85, washAlpha: 0.1, background: 'brand-panel-deep' },
  // Auth feature tile over the glow orb.
  { foreground: 'brand-panel-foreground', textAlpha: 1, washAlpha: 0.2, background: 'brand-panel' },
  { foreground: 'brand-panel-foreground', textAlpha: 1, washAlpha: 0.2, background: 'brand-panel-deep' },
];

// Focus indicators and panel controls are non-text: WCAG 1.4.11 asks for 3:1 against what they touch.
const minimumNonTextContrast = 3;
const nonTextChecks = [
  ['ring', 'background'],
  ['ring', 'card'],
  ['ring', 'popover'],
  ['ring', 'bg-canvas'],
  ['ring', 'bg-surface'],
  ['ring', 'bg-subtle'],
  ['ring', 'secondary'],
  ['ring', 'muted'],
  ['ring', 'accent'],
  ['brand-panel-action', 'brand-panel'],
  ['brand-panel-action', 'brand-panel-deep'],
];

// Fill states must be distinguishable from the surface they sit on. A menu highlight or a skeleton
// that resolves to its surface color simply disappears.
const minimumFillSeparation = 1.05;
const separationChecks = [
  ['accent', 'popover'],
  ['accent', 'card'],
  ['muted', 'card'],
  ['muted', 'popover'],
  ['secondary', 'card'],
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Returns the stylesheet's rule blocks in source order: [{ selector, declarations }].
function readBlocks(file) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const blocks = [];
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map();
    for (const declaration of match[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      declarations.set(declaration[1], declaration[2].trim());
    }
    blocks.push({ selector: match[1].trim(), declarations });
  }
  return blocks;
}

// Local stylesheets imported by a stylesheet, in order.
function localImports(file) {
  const source = stripComments(readFileSync(file, 'utf8'));
  return [...source.matchAll(/@import\s+['"](\.[^'"]+)['"]/g)].map(match =>
    resolve(dirname(file), match[1])
  );
}

// Token values for one mode after the cascade of the given stylesheets.
function cascade(files, mode) {
  const tokens = new Map();
  for (const file of files) {
    for (const { selector, declarations } of readBlocks(file)) {
      if (selector === ':root' || (mode === 'dark' && selector === '.dark')) {
        for (const [name, value] of declarations) {
          tokens.set(name, value);
        }
      }
    }
  }
  return tokens;
}

function resolveColor(token, tokens, seen = new Set()) {
  if (seen.has(token)) {
    throw new Error(`Circular color token: --${token}`);
  }

  const value = tokens.get(token);
  if (!value) {
    throw new Error(`Unknown color token: --${token}`);
  }

  const reference = /^var\(--([a-z0-9-]+)\)$/i.exec(value)?.[1];
  if (reference) {
    return resolveColor(reference, tokens, new Set([...seen, token]));
  }

  const color = parse(value);
  if (!color) {
    throw new Error(`Unsupported color value for --${token}: ${value}`);
  }
  if (color.alpha !== undefined && color.alpha < 1) {
    throw new Error(`--${token} is translucent (${value}); readable pairs need opaque colors`);
  }

  return color;
}

const failures = [];
let checked = 0;

const toRgb = converter('rgb');

// Composites a translucent color over an opaque one in gamma-encoded sRGB, as browsers paint by default.
function blend(color, alpha, base) {
  const top = toRgb(color);
  const bottom = toRgb(base);
  const channel = name => top[name] * alpha + bottom[name] * (1 - alpha);
  return { mode: 'rgb', r: channel('r'), g: channel('g'), b: channel('b') };
}

function checkLayers(label, files) {
  for (const mode of ['light', 'dark']) {
    const tokens = cascade(files, mode);
    const measure = (description, minimum, compare) => {
      checked += 1;
      try {
        const ratio = compare();
        if (ratio < minimum) {
          failures.push(
            `${label} ${mode}: ${description} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`
          );
        }
      } catch (error) {
        failures.push(`${label} ${mode}: ${error.message}`);
      }
    };
    const pair = (foreground, background, minimum) =>
      measure(`--${foreground} on --${background}`, minimum, () =>
        wcagContrast(resolveColor(foreground, tokens), resolveColor(background, tokens))
      );

    for (const [foreground, background] of checks) {
      pair(foreground, background, minimumTextContrast);
    }
    for (const [foreground, background] of nonTextChecks) {
      pair(foreground, background, minimumNonTextContrast);
    }
    for (const [fill, surface] of separationChecks) {
      pair(fill, surface, minimumFillSeparation);
    }
    for (const { foreground, textAlpha, washAlpha, background } of blendedChecks) {
      measure(
        `--${foreground} at ${textAlpha} on --${background} under a ${washAlpha} wash`,
        minimumTextContrast,
        () => {
          const text = resolveColor(foreground, tokens);
          const surface = blend(text, washAlpha, resolveColor(background, tokens));
          return wcagContrast(blend(text, textAlpha, surface), surface);
        }
      );
    }
  }
}

// A preset that overrides a token on :root must override it on .dark too when the core tokens
// give it a dark value; otherwise the preset's light value, imported later, wins in dark mode.
function checkPresetShape(label, presetFile, coreFiles) {
  const coreDark = new Set(
    coreFiles.flatMap(file =>
      readBlocks(file)
        .filter(block => block.selector === '.dark')
        .flatMap(block => [...block.declarations.keys()])
    )
  );
  const blocks = readBlocks(presetFile);
  for (const block of blocks) {
    if (block.selector !== ':root' && block.selector !== '.dark') {
      failures.push(`${label}: only :root and .dark blocks are allowed, found "${block.selector}"`);
    }
  }
  const presetDark = new Set(
    blocks
      .filter(block => block.selector === '.dark')
      .flatMap(block => [...block.declarations.keys()])
  );
  for (const block of blocks.filter(candidate => candidate.selector === ':root')) {
    for (const name of block.declarations.keys()) {
      if (coreDark.has(name) && !presetDark.has(name)) {
        failures.push(
          `${label}: --${name} is set on :root but not on .dark, so it leaks into dark mode`
        );
      }
    }
  }
}

const imported = localImports(join(themeRoot, 'index.css'));
const coreFiles = imported.filter(file => !file.startsWith(presetRoot + '/'));
checkLayers('web', imported);
for (const file of imported.filter(candidate => candidate.startsWith(presetRoot + '/'))) {
  checkPresetShape(relative(webRoot, file), file, coreFiles);
}

let registryThemes = 0;
if (existsSync(registryPlugins)) {
  for (const plugin of readdirSync(registryPlugins).sort()) {
    const presetDirectory = join(registryPlugins, plugin, 'files/web/src/themes/presets');
    if (!existsSync(presetDirectory)) {
      continue;
    }
    for (const name of readdirSync(presetDirectory)
      .filter(file => file.endsWith('.css'))
      .sort()) {
      const presetFile = join(presetDirectory, name);
      const label = relative(resolve(webRoot, '..'), presetFile);
      registryThemes += 1;
      checkPresetShape(label, presetFile, coreFiles);
      checkLayers(label, [...coreFiles, presetFile]);
    }
  }
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test') {
        return [];
      }
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

for (const file of sourceFiles(sourceRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/text-destructive/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    failures.push(
      `${relative(webRoot, file)}:${line}: use text-error for readable copy; destructive is a surface/border token`
    );
  }

  const lines = source.split('\n');
  const panelFile = lines.some(line => /\bfrom-brand-panel\b/.test(line));
  lines.forEach((line, index) => {
    // --primary is light in dark mode, so a primary gradient surface has no fixed text color.
    // Gradient text (bg-clip-text) is fine; it is covered by the primary pairs above.
    if (/\bfrom-primary\b/.test(line) && !line.includes('bg-clip-text')) {
      failures.push(
        `${relative(webRoot, file)}:${index + 1}: use from-brand-panel for gradient surfaces; primary flips lightness in dark mode`
      );
    }
    if (panelFile && /\b(?:text|border|bg)-white\b/.test(line)) {
      failures.push(
        `${relative(webRoot, file)}:${index + 1}: use brand-panel-foreground on brand panels; white is unreadable when the panel is light`
      );
    }
  });
}

if (failures.length > 0) {
  console.error(`Theme contrast guard failed:\n${failures.map(failure => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

console.log(
  `Theme contrast guard passed: ${checked} checks (text ${minimumTextContrast}:1, focus rings and controls ${minimumNonTextContrast}:1, fill separation ${minimumFillSeparation}:1) across the installed tokens and ${registryThemes} registry theme preset(s); gradient surfaces use brand panel tokens; readable copy avoids the destructive surface token.`
);
