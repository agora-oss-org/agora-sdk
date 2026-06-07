#!/usr/bin/env bash
# Re-applies the upstream package scope -> @agora-sdk/* across the workspace. Upstream was
# @replyke/* and, since their rebrand (merged into `agora` via `-s ours`), is now @sublay/* —
# this converts both.
#
# The published npm scope is @agora-sdk (the @agora scope was unavailable). This script also
# folds any lingering @agora/* refs into @agora-sdk/* so older checkouts converge cleanly.
#
# Idempotent + deterministic: safe to run any number of times (once @replyke / @sublay / @agora
# are gone it's a no-op — @agora-sdk/ matches none of them). This is the ONLY mechanical part of
# our fork divergence — the base-URL repoint lives as committed code on the `agora` branch. After
# merging upstream, re-run this to re-apply the scope to any new @replyke / @sublay references
# upstream introduced. See SYNCING.md.
set -euo pipefail
cd "$(dirname "$0")"

# Three substitutions, applied to TS sources + every package.json:
#
#  1. @replyke/ -> @agora-sdk/  ONLY inside quotes (import specifiers, package.json keys).
#     Quote-anchoring is deliberate: our Apache-2.0 attribution comments reference the
#     *original* upstream package ("Modified from the original @replyke/core source") and
#     MUST keep saying @replyke. Upstream's own code only ever names @replyke in quoted
#     import specifiers, so this still catches every real import a merge introduces.
#  2. @sublay/ -> @agora-sdk/  ONLY inside quotes (same reasoning). Upstream rebranded
#     @replyke -> @sublay, so new code a merge introduces names @sublay in quoted import
#     specifiers. Quote-anchoring leaves any future @sublay attribution prose untouched.
#  3. @agora/ -> @agora-sdk/  EVERYWHERE (the interim @agora scope was unpublished; convert
#     our own imports and prose alike). @agora-sdk/ doesn't match @agora/, so it's idempotent.
SUBST='s{(["'\''])\@replyke/}{$1\@agora-sdk/}g; s{(["'\''])\@sublay/}{$1\@agora-sdk/}g; s{\@agora/}{\@agora-sdk/}g'

find packages -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'package.json' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -print0 \
  | xargs -0 perl -i -pe "$SUBST"

# Root package.json (publish scripts use --filter @replyke/...).
perl -i -pe "$SUBST" package.json

# Count leftovers the script targets: quoted @replyke imports + any @agora/ ref (expect 0).
# Unquoted @replyke in attribution comments is intentional and not counted.
remaining=$( { grep -rEl "[\"']@replyke/|[\"']@sublay/|@agora/" packages package.json --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null || true; } | { grep -vE 'node_modules|/dist/' || true; } | wc -l | tr -d ' ')
echo "✓ rename applied. Files still needing rename (quoted @replyke/@sublay or @agora/): ${remaining} (expect 0)"
echo "  Next: pnpm install   (relink workspace)  &&  pnpm run build-all"
