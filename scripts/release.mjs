// Prepares a release: picks the next version, bumps package.json, updates the
// pinned CDN links in README.md and index.html, and adds a CHANGELOG entry.
//
//   node scripts/release.mjs [auto|patch|minor|major] [--dry-run]
//
// "auto" (the default) reads the commit messages since the last v* tag:
//   - "BREAKING CHANGE" or a "type!:" subject → major (minor while on 0.x)
//   - a "feat:" subject                       → minor (patch while on 0.x)
//   - anything else                           → patch
// If no v* tag exists yet, the current package.json version is released as is.
//
// If CHANGELOG.md already has a heading for the new version, it is kept and used
// as the release notes. Otherwise one is written from the commit subjects.
// Notes go to release-notes.md. When run in GitHub Actions, the version is
// written to $GITHUB_OUTPUT.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bump = args.find((a) => !a.startsWith('--')) ?? 'auto';
if (!['auto', 'patch', 'minor', 'major'].includes(bump)) throw new Error(`unknown bump: ${bump}`);

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const file = (name) => path.join(root, name);

const pkg = JSON.parse(readFileSync(file('package.json'), 'utf8'));
const current = pkg.version;

let lastTag = '';
try {
  lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {}

const commits = git('log', '--no-merges', '--format=%s%n%b%x00', lastTag ? `${lastTag}..HEAD` : 'HEAD')
  .split('\0')
  .map((c) => c.trim())
  .filter((c) => c && !c.startsWith('release: '));

function nextVersion() {
  if (!lastTag) return current;
  const [major, minor, patch] = current.split('.').map(Number);
  let level = bump;
  if (level === 'auto') {
    const breaking = commits.some((c) => /BREAKING CHANGE/.test(c) || /^\w+(\(.+\))?!:/.test(c));
    const feature = commits.some((c) => /^feat(\(.+\))?:/.test(c));
    level = breaking ? 'major' : feature ? 'minor' : 'patch';
    // Pre-1.0, shift down one level so an automatic bump never reaches 1.0.0.
    if (major === 0) level = level === 'major' ? 'minor' : 'patch';
  }
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const version = nextVersion();
const date = new Date().toISOString().slice(0, 10);

// Release notes: an existing CHANGELOG section wins, otherwise commit subjects.
const changelog = readFileSync(file('CHANGELOG.md'), 'utf8');
const heading = new RegExp(`^## ${version.replaceAll('.', '\\.')}\\b.*$`, 'm');
let notes;
let newChangelog = changelog;
const existing = changelog.match(heading);
if (existing) {
  const start = existing.index + existing[0].length;
  const end = changelog.indexOf('\n## ', start);
  notes = changelog.slice(start, end === -1 ? undefined : end).trim();
} else {
  const subjects = [...new Set(commits.map((c) => c.split('\n')[0]))];
  notes = subjects.length ? subjects.map((s) => `- ${s}`).join('\n') : '- Maintenance release.';
  const entry = `## ${version} — ${date}\n\n${notes}\n\n`;
  const first = changelog.indexOf('\n## ');
  newChangelog = first === -1 ? `${changelog.trimEnd()}\n\n${entry}` : changelog.slice(0, first + 1) + entry + changelog.slice(first + 1);
}

console.log(`${lastTag || '(no tag)'} → v${version}${dryRun ? ' (dry run)' : ''}\n\n${notes}`);
if (dryRun) process.exit(0);

if (version !== current) {
  execFileSync('npm', ['version', version, '--no-git-tag-version'], { cwd: root, stdio: 'ignore' });
  // Pinned CDN links (yearn.css@x.y.z/) and the JSON-LD version in the demo.
  for (const name of ['README.md', 'index.html']) {
    const text = readFileSync(file(name), 'utf8')
      .replaceAll(`yearn.css@${current}/`, `yearn.css@${version}/`)
      .replaceAll(`"version": "${current}"`, `"version": "${version}"`);
    writeFileSync(file(name), text);
  }
}
writeFileSync(file('CHANGELOG.md'), newChangelog);
writeFileSync(file('release-notes.md'), `${notes}\n`);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
