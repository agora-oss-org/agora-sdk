#!/usr/bin/env bash
# Release driver: bump every published @agora-sdk/* package in lockstep, commit the
# bump, create an annotated tag, and push the branch + tag to both mirrors.
#
# Pushing the tag to `github` triggers .github/workflows/publish.yml, which builds
# and publishes the packages to npm. Versions are kept identical across all packages.
#
# Usage:  ./scripts/release.sh <major|minor|patch>
# Wired:  pnpm run major | pnpm run minor | pnpm run patch
set -euo pipefail
cd "$(dirname "$0")/.."

BUMP="${1:-}"
case "$BUMP" in
  major|minor|patch) ;;
  *) echo "Usage: $0 <major|minor|patch>" >&2; exit 1 ;;
esac

# Must be on a real branch — the tag should point at a branch commit, not a detached HEAD.
BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
[ -n "$BRANCH" ] || { echo "Error: detached HEAD. Check out a branch before releasing." >&2; exit 1; }

# Refuse to release on top of uncommitted work, so the bump commit is exactly the bump.
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean. Commit or stash changes first:" >&2
  git status --short >&2
  exit 1
fi

# Bump all four published packages together (no per-package git tag — we tag once below).
# `exec npm version` runs the bump inside each package dir; `pnpm ... version` would instead
# look for a script named "version" and silently no-op.
pnpm \
  --filter @agora-sdk/core \
  --filter @agora-sdk/expo \
  --filter @agora-sdk/react-js \
  --filter @agora-sdk/react-native \
  exec npm version "$BUMP" --no-git-tag-version

VERSION="$(node -p "require('./packages/core/package.json').version")"
TAG="v$VERSION"

# Don't clobber an existing tag (leaves the bump in the working tree for inspection).
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Error: tag $TAG already exists. Bump left uncommitted in working tree." >&2
  exit 1
fi

git add \
  packages/core/package.json \
  packages/expo/package.json \
  packages/react-js/package.json \
  packages/react-native/package.json \
  pnpm-lock.yaml

git commit -m "🔖 chore(release): $TAG"
git tag -a "$TAG" -m "Release $TAG"

# Push the branch + tag to every mirror that exists (skip upstream — read-only Replyke).
for remote in origin github; do
  if git remote get-url "$remote" >/dev/null 2>&1; then
    echo "→ Pushing $BRANCH and $TAG to $remote"
    git push "$remote" "$BRANCH"
    git push "$remote" "$TAG"
  fi
done

echo "✓ Released $TAG. GitHub Actions (publish.yml) will build & publish to npm."
