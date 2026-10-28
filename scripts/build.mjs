// Builds minified copies of yearn.css and every theme into dist/.
//
//   dist/yearn.min.css        everything, including the Google Fonts @import
//   dist/yearn.core.min.css   no @import: bring your own fonts (or use system fallbacks)
//   dist/themes/*.min.css     each theme
//
// No browser targets are passed, so modern syntax (light-dark(), :has(), nesting)
// is kept as written — only whitespace and comments are removed.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { transform } from 'lightningcss';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

function minify(filename, css) {
  const { code } = transform({ filename, code: Buffer.from(css), minify: true });
  return code;
}

async function write(file, code) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, code);
  const kb = (n) => (n / 1024).toFixed(1).padStart(5) + ' KB';
  console.log(`${kb(code.length)}  ${kb(gzipSync(code).length)} gz  ${path.relative(root, file)}`);
}

const source = await readFile(path.join(root, 'yearn.css'), 'utf8');
await write(path.join(dist, 'yearn.min.css'), minify('yearn.css', source));

const core = source.replace(/^@import url\([^)]*fonts\.googleapis[^)]*\);\s*/m, '');
if (core === source) throw new Error('Expected a Google Fonts @import at the top of yearn.css');
await write(path.join(dist, 'yearn.core.min.css'), minify('yearn.core.css', core));

for (const name of await readdir(path.join(root, 'themes'))) {
  if (!name.endsWith('.css') || name.startsWith('_')) continue;
  const css = await readFile(path.join(root, 'themes', name), 'utf8');
  await write(path.join(dist, 'themes', name.replace(/\.css$/, '.min.css')), minify(name, css));
}
