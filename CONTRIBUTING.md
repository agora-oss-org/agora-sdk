# Contributing to Agora

Thanks for your interest in contributing! 💜 Agora is an open-source, TypeScript-first SDK
for social features (comments, votes, feeds, follows, chat, and more), built as a fork of
[Replyke](https://github.com/replyke/monorepo). Contributions of all kinds are welcome — bug
reports, docs, examples, and code.

Please read the [**fork model**](#-important-this-is-a-fork-of-replyke) section before opening a
pull request; it's the one thing that's easy to get wrong here.

## Code of conduct

Be kind, be constructive, assume good faith. Harassment or discrimination of any kind isn't
welcome. We're a small project — treat maintainers and fellow contributors the way you'd want to
be treated.

## Ways to contribute

- **Report a bug** — open an issue with steps to reproduce, the package + version (`@agora-sdk/*`),
  and what you expected vs. saw.
- **Suggest a feature** — open an issue describing the use case. Because Agora tracks upstream
  Replyke (see below), new behavior is weighed against how hard it makes future merges.
- **Improve docs** — README, this file, [SYNCING.md](SYNCING.md), or the Claude Code skill under
  [`plugins/agora/`](plugins/agora/). Docs-only PRs are very welcome.
- **Send code** — bug fixes and small, focused features. For anything large, open an issue first so
  we can agree on the approach before you invest time.

## ⚠️ Important: this is a fork of Replyke

Agora mirrors upstream Replyke and re-applies a deliberately small set of changes on top. Keeping
that delta small is what makes upstream merges cheap, so the branch model matters:

| Branch | What it is |
|---|---|
| **`main`** | Mirrors `upstream/main` **verbatim** — original `@replyke/*` names, **no edits**. Don't PR here. |
| **`agora`** | Our working branch (the repo default): `@agora-sdk/*` scope + the Agora changes. **PRs target `agora`.** |

**Open every pull request against the `agora` branch, never `main`.** A PR to `main` breaks the
sync model and will be redirected.

Three things — and only these three — diverge from upstream. Respect them when editing:

1. **Base-URL repoint** (4 files) — the SDK reads its API base URL from the `baseUrl` prop via
   `getApiBaseUrl()`, not from env-var auto-detection. If you touch these, keep upstream's
   surrounding logic intact.
2. **The `@replyke/*` → `@agora-sdk/*` rename is scripted, not hand-edited.** It's produced by
   `./rename-to-agora.sh` (idempotent). **Don't manually rename imports** — if you add code that
   references `@replyke/*` while merging upstream, let the script convert it.
3. **Auth-flow behavior** (3 files) — `SignUpResult`, always-clear-on-sign-out, and the
   account-map guard. These files carry a `Modified from original @replyke/core` header
   (Apache-2.0 §4(b)) — **preserve that header** and keep edits surgical.

Full detail (with file paths and the merge workflow) lives in [SYNCING.md](SYNCING.md). When in
doubt, prefer the smallest change that derives from `getApiBaseUrl()` rather than a new fork point.

## Development setup

This is a [pnpm](https://pnpm.io) monorepo.

```bash
git clone https://github.com/jenova-marie/agora-sdk.git
cd agora-sdk
git checkout agora          # work off the default branch
pnpm install
pnpm run build-all          # builds all packages in dependency order
```

Build a single package while iterating:

```bash
pnpm --filter @agora-sdk/core run build
```

### Project layout

```
packages/
  core/          @agora-sdk/core         — hooks, providers, types (React + RN)
  react-js/      @agora-sdk/react-js      — web (localStorage, OAuth)
  react-native/  @agora-sdk/react-native  — bare RN (Keychain)
  expo/          @agora-sdk/expo          — Expo (SecureStore)
plugins/agora/   Claude Code plugin (skill that teaches agents to build on the SDK)
```

## Making a change

1. **Branch off `agora`**: `git checkout -b fix/short-description agora`.
2. Make your change, keeping it focused and consistent with the surrounding code.
3. **Update [`CHANGELOG.md`](CHANGELOG.md)** in the same PR — add a bullet under `## [Unreleased]`
   in the right group (`Added` / `Changed` / `Fixed` / `Removed`). This is required.
4. Make sure it builds: `pnpm run build-all` (CI runs install → build-all → typecheck).
5. Open a PR **against `agora`** with a clear description of what and why.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) with a leading emoji, matching
the existing history — e.g. `✨ feat(core): …`, `🐛 fix(react-js): …`, `📝 docs: …`,
`♻️ refactor: …`. Use the imperative mood and keep the subject under ~72 characters.

### Pull request checklist

- [ ] Targets the **`agora`** branch
- [ ] `pnpm run build-all` passes
- [ ] `CHANGELOG.md` `[Unreleased]` updated
- [ ] Change is surgical and doesn't widen the divergence from upstream unnecessarily
- [ ] Any edited fork-modified file keeps its `Modified from original @replyke/core` header
- [ ] Commit messages follow the convention above

## Releases

Releases are cut by maintainers, not in PRs. The flow (for reference) is `pnpm run patch` /
`minor` / `major`, which bumps every `@agora-sdk/*` package in lockstep, tags `vX.Y.Z`, and pushes;
the tag triggers the publish workflow. Just land your change on `agora` with a `[Unreleased]`
changelog entry — it'll go out in the next release.

## License & attribution

Agora is licensed under the [Apache License, Version 2.0](LICENSE). By contributing, you agree your
contributions are licensed under the same terms. Keep the [`NOTICE`](NOTICE) file and the
`Modified from original @replyke/core` headers intact — they're how this fork honors upstream
Replyke's Apache-2.0 attribution requirement.

---

Questions before you dive in? Open an issue — happy to help. 🌸
