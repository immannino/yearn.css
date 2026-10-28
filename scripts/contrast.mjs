// WCAG contrast audit for yearn.css and every theme, in light and dark mode.
//
//   npm run contrast             all themes
//   npm run contrast -- dusk     one theme
//
// Reads the :root token block of each file, resolves light-dark() for each mode,
// composites semi-transparent text over its background, and checks the pairs below.
// Exits non-zero if anything fails, so it can run in CI.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// [label, foreground, text opacity, background, minimum ratio, mode override]
const CHECKS = [
  ['body text on page', '--y-fg', 0.86, '--y-bg', 4.5],
  ['muted text on card', '--y-fg', 0.72, '--y-surface', 4.5],
  ['labels on page', '--y-fg', 0.64, '--y-bg', 4.5],
  ['links on page', '--y-accent', 1, '--y-bg', 4.5],
  ['links on card', '--y-accent', 1, '--y-surface', 4.5],
  ['button text', '--y-on-ink', 1, '--y-ink', 4.5],
  ['hover / checkbox text', '--y-on-accent', 1, '--y-accent', 4.5],
  ['hero text, top', '--y-fg', 0.86, '--y-hero-from', 4.5],
  ['hero text, bottom', '--y-fg', 0.86, '--y-hero-to', 3],
  ['footer links', '--y-fg', 0.82, '--y-footer-bg', 4.5, 'dark'],
  ['code', '--y-pre-fg', 1, '--y-pre-bg', 4.5],
];

async function tokens(file) {
  const css = await readFile(file, 'utf8');
  const block = css.match(/:root \{([\s\S]*?)\n\}/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--y-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function splitArgs(s) {
  const parts = [''];
  let depth = 0;
  for (const ch of s) {
    if (ch === ',' && depth === 0) { parts.push(''); continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    parts[parts.length - 1] += ch;
  }
  return parts.map((p) => p.trim());
}

function resolve(value, mode, t) {
  let v = value.trim();
  const ld = v.match(/^light-dark\((.*)\)$/);
  if (ld) v = splitArgs(ld[1])[mode === 'light' ? 0 : 1];
  const ref = v.match(/^var\((--y-[\w-]+)\)$/);
  if (ref) return resolve(t[ref[1]], mode, t);
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).concat(1);
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const n = rgb[1].split(',').map(Number);
    return [n[0] / 255, n[1] / 255, n[2] / 255, n[3] ?? 1];
  }
  throw new Error(`can't resolve ${value}`);
}

const over = (fg, bg, alpha) => {
  const a = fg[3] * alpha;
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};
const lum = (c) => {
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const base = await tokens(path.join(root, 'yearn.css'));
const themes = [['default', {}]];
for (const name of (await readdir(path.join(root, 'themes'))).sort()) {
  if (name.endsWith('.css') && !name.startsWith('_')) {
    themes.push([name.slice(0, -4), await tokens(path.join(root, 'themes', name))]);
  }
}
const only = process.argv[2];

let failures = 0;
for (const [name, own] of themes) {
  if (only && only !== name) continue;
  const t = { ...base, ...own };
  for (const mode of ['light', 'dark']) {
    for (const [label, fgVar, alpha, bgVar, min, forced] of CHECKS) {
      // A theme that replaces the whole hero image can't be checked stop by stop.
      if (bgVar.startsWith('--y-hero') && own['--y-hero']) continue;
      const m = forced ?? mode;
      const bg = resolve(t[bgVar], m, t).slice(0, 3);
      const r = ratio(over(resolve(t[fgVar], m, t), bg, alpha), bg);
      if (r < min) {
        failures++;
        console.log(`✗ ${name.padEnd(13)} ${mode.padEnd(5)} ${label.padEnd(22)} ${r.toFixed(2)} (needs ${min})`);
      }
    }
  }
}
console.log(failures ? `\n${failures} contrast failure(s)` : `✓ all contrast checks pass (${only ?? `${themes.length} themes`}, light + dark)`);
process.exit(failures ? 1 : 0);
