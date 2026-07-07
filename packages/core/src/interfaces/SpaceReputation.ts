/**
 * Shared optional params for opting embedded/returned users into a
 * space-scoped reputation value (`spaceReputation`; see
 * {@link import("./models/User").UserFull}).
 *
 * The relationship is expressed as a single `spaceReputation` object —
 * `{ spaceId, includeDescendants? }` — rather than the two flat props it
 * replaces, because the two always travel together and `includeDescendants`
 * is only meaningful alongside an explicit `spaceId`.
 *
 * Two variants exist because the server accepts a different value set per
 * endpoint class:
 * - {@link SpaceReputationContextParams} — context endpoints (entities,
 *   comments, chat, spaces team/members, search, reports). Accept
 *   `<uuid> | "none" | "context"`.
 * - {@link SpaceReputationUserParams} — user-direct endpoints (the `users`
 *   module). Accept `<uuid> | "none"` only; `"context"` is rejected (400).
 *
 * Both variants also keep the now-deprecated flat props
 * (`spaceReputationId` / `spaceReputationDescendants`) so existing callers
 * keep working unchanged. When both forms are supplied the object wins.
 */

/**
 * The space-reputation object for context endpoints (entities, comments,
 * chat, spaces team/members, search, reports).
 */
export interface SpaceReputationContextObject {
  /**
   * Which space's reputation to attach to the returned/embedded user(s).
   * Accepted forms:
   * - a space `<uuid>` — reputation scoped to that specific space
   * - `"none"` — the user's global, non-space reputation
   * - `"context"` — reputation scoped to each row's own space (per-row)
   */
  spaceId: string | "none" | "context";
  /**
   * Include reputation accrued in descendant spaces. Only honored when
   * `spaceId` is an explicit `<uuid>`; ignored for `"none"` and disallowed
   * (not applicable) with `"context"`.
   */
  includeDescendants?: boolean;
}

/**
 * The space-reputation object for user-direct endpoints. Same as
 * {@link SpaceReputationContextObject} but `"context"` is rejected by the
 * server (400) on these routes — only a `<uuid>` or `"none"` is valid.
 */
export interface SpaceReputationUserObject {
  /**
   * Which space's reputation to attach to the returned user(s).
   * Accepted forms:
   * - a space `<uuid>` — reputation scoped to that specific space
   * - `"none"` — the user's global, non-space reputation
   *
   * Note: `"context"` is rejected by the server (400) on user-direct routes;
   * pass an explicit `<uuid>` or `"none"` here.
   */
  spaceId: string | "none";
  /**
   * Include reputation accrued in descendant spaces. Only honored when
   * `spaceId` is an explicit `<uuid>`; ignored for `"none"`.
   */
  includeDescendants?: boolean;
}

/**
 * Space-reputation params for endpoints whose controllers enrich users from
 * the *current request context* (entities, comments, chat, spaces
 * team/members, search, reports).
 */
export interface SpaceReputationContextParams {
  /**
   * Opt the returned/embedded user(s) into a space-scoped `spaceReputation`.
   * This is the primary form; it supersedes the deprecated flat props below.
   */
  spaceReputation?: SpaceReputationContextObject;
  /**
   * Which space's reputation to attach. Accepts a space `<uuid>`, `"none"`
   * (global reputation), or `"context"` (per-row).
   *
   * @deprecated Use `spaceReputation: { spaceId, includeDescendants? }`
   * instead. Still accepted for backward compatibility; ignored when the
   * `spaceReputation` object is supplied.
   */
  spaceReputationId?: string;
  /**
   * Include reputation accrued in descendant spaces. Only honored when
   * `spaceReputationId` is an explicit `<uuid>`.
   *
   * @deprecated Use `spaceReputation.includeDescendants` instead. Still
   * accepted for backward compatibility; ignored when the `spaceReputation`
   * object is supplied.
   */
  spaceReputationDescendants?: boolean;
}

/**
 * Space-reputation params for user-direct endpoints (e.g. `/users/:id`,
 * `/users/by-username`, `/users/:id/followers`). Same fields as
 * {@link SpaceReputationContextParams}, but `"context"` is rejected by the
 * server (400) on these routes — only a `<uuid>` or `"none"` is valid.
 */
export interface SpaceReputationUserParams {
  /**
   * Opt the returned user(s) into a space-scoped `spaceReputation`.
   * This is the primary form; it supersedes the deprecated flat props below.
   */
  spaceReputation?: SpaceReputationUserObject;
  /**
   * Which space's reputation to attach. Accepts a space `<uuid>` or `"none"`
   * (global reputation). `"context"` is rejected by the server (400) here.
   *
   * @deprecated Use `spaceReputation: { spaceId, includeDescendants? }`
   * instead. Still accepted for backward compatibility; ignored when the
   * `spaceReputation` object is supplied.
   */
  spaceReputationId?: string;
  /**
   * Include reputation accrued in descendant spaces. Only honored when
   * `spaceReputationId` is an explicit `<uuid>`.
   *
   * @deprecated Use `spaceReputation.includeDescendants` instead. Still
   * accepted for backward compatibility; ignored when the `spaceReputation`
   * object is supplied.
   */
  spaceReputationDescendants?: boolean;
}
