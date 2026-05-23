#!/usr/bin/env bash
# Re-applies the @replyke/* -> @agora/* package-scope rename across the workspace.
#
# Idempotent + deterministic: safe to run any number of times (once @replyke is gone it's a no-op).
# This is the ONLY mechanical part of our fork divergence — the base-URL repoint lives as committed
# code on the `agora` branch. After merging upstream, re-run this to re-apply the scope to any new
# @replyke references upstream introduced. See SYNCING.md.
set -euo pipefail
cd "$(dirname "$0")"

# Rewrite the scope in TS sources + every package.json (the published name + workspace deps),
# skipping build output and dependencies.
find packages -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'package.json' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -print0 \
  | xargs -0 perl -i -pe 's{\@replyke/}{\@agora/}g'

# Root package.json (publish scripts use --filter @replyke/...).
perl -i -pe 's{\@replyke/}{\@agora/}g' package.json

remaining=$(grep -rl "@replyke/" packages package.json --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null | grep -vE 'node_modules|/dist/' | wc -l | tr -d ' ')
echo "✓ rename applied. Files still referencing @replyke/: ${remaining} (expect 0)"
echo "  Next: pnpm install   (relink workspace)  &&  pnpm run build-all"
