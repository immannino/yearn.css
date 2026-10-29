#!/bin/sh
# Cuts a release from your machine: bumps the version, rebuilds dist/, commits,
# tags vX.Y.Z and pushes. The tag push makes the Release workflow create the
# GitHub release. jsDelivr serves the tag on its own.
#
#   npm run release                 # bump from commit messages (see release.mjs)
#   npm run release -- minor        # or force patch | minor | major
#   npm run release -- --dry-run    # show the next version and notes, change nothing

set -eu
cd "$(dirname "$0")/.."

bump="auto"
for arg in "$@"; do
  case "$arg" in
    --dry-run) exec node scripts/release.mjs "$bump" --dry-run ;;
    *) bump="$arg" ;;
  esac
done

[ "$(git branch --show-current)" = main ] || { echo "Switch to main first." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first." >&2; exit 1; }
git fetch --quiet --tags origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main isn't in sync with origin/main. Pull or push first." >&2; exit 1; }

npm run --silent contrast
node scripts/release.mjs "$bump"
version="$(node -p "require('./package.json').version")"
if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "v$version is already tagged." >&2
  git checkout -- . && exit 1
fi
npm run --silent build
rm -f release-notes.md

git add package.json package-lock.json README.md index.html CHANGELOG.md dist
git diff --cached --quiet || git commit --quiet -m "release: v$version"
git tag -a "v$version" -m "v$version"
git push --quiet origin main "v$version"

echo
echo "Released v$version"
echo "  https://github.com/immannino/yearn.css/releases/tag/v$version (created by the workflow in a minute)"
echo "  https://cdn.jsdelivr.net/gh/immannino/yearn.css@$version/dist/yearn.min.css"
