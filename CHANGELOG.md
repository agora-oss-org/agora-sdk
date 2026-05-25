# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

This is a fork of [Replyke](https://github.com/replyke/monorepo); entries below
describe how the `@agora-sdk/*` packages diverge from upstream. See
[SYNCING.md](SYNCING.md) for the upstream-merge workflow.

## [Unreleased]

### Added

- CI workflow (`.github/workflows/ci.yml`): install, build-all, then typecheck on
  pushes/PRs to `agora`.
- Publish workflow (`.github/workflows/publish.yml`): on a `v*` tag, verify the tag
  matches `@agora-sdk/core`'s version, build, and publish all packages to npm.
- `scripts/release.sh` plus root `major` / `minor` / `patch` scripts to bump all
  packages in lockstep, commit, tag, and push to `origin` + `github`.
- This `CHANGELOG.md`.

### Changed

- Rescoped all packages from `@replyke/*` to `@agora-sdk/*` (the `@agora` scope was
  unavailable). The mechanical rename lives in `rename-to-agora.sh`.
- API base URL + chat socket origin are now **injected explicitly** via a new
  `<ReplykeProvider baseUrl="https://host/v7">` prop and read **lazily per request**
  (new `config/runtime.ts`; axios uses a request interceptor, RTK-Query a dynamic
  baseQuery). The consuming app parses its own platform env and passes the value in.
  Defaults to `http://localhost:4000/v7` when omitted.
- Rebranded `README.md` to Agora and documented the four shipped packages.

### Removed

- Environment-variable **auto-detection** of the API base URL. `getApiBaseUrl()` no
  longer sniffs `REACT_APP_API_BASE_URL` / `VITE_API_BASE_URL` (that path couldn't
  read `import.meta.env` reliably and was evaluated eagerly at import). It is now a
  runtime getter for the value set via `baseUrl`. **Breaking:** consumers relying on
  env auto-detection must pass `baseUrl` to `ReplykeProvider`.

### Fixed

- Release/version scripts now use `pnpm --filter ... exec npm version` so package
  versions actually bump (the bare `pnpm ... version` form silently no-ops).
- Quote-anchored the scope rename so Apache-2.0 attribution comments keep referencing
  the upstream `@replyke/*` origin while real imports still convert.

[Unreleased]: https://github.com/jenova-marie/agora-sdk/commits/agora
