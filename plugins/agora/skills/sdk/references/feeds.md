# Feeds & Ranking (Entity Lists)

An **entity list** is a paginated, filtered, sorted collection of entities (posts/articles/etc.) — the feed primitive. Wrap a region in `EntityListProvider` (or use the hooks under the root provider) and read it with `useEntityList()`; mutate filters/sort/pagination with `useEntityListActions()`.

```tsx
import { useEntityList, useEntityListActions } from "@agora-sdk/react-js";

const { entities, loading, hasMore } = useEntityList();
const { fetchNextPage, setSortBy, setFilters } = useEntityListActions();
```

For exact return shapes and filter fields (unchanged from upstream except the ranking additions below), use the **lookup ladder** in [SKILL.md](../SKILL.md): offline `cat node_modules/@agora-sdk/core/dist/esm/hooks/entity-lists/*.d.ts`, or prose at MCP/docs `/v7/hooks/entity-lists/use-entity-list` + `use-entity-list-actions`.

## Sorting

`EntityListSortByOptions` (from `@agora-sdk/core/interfaces/EntityListSortByOptions.ts`):

```ts
type EntityListSortByOptions =
  | "top" | "hot" | "new" | "controversial"   // stock upstream
  | "decay" | "gravity" | "wilson" | "bayesian"  // ⚠️ Agora additions
  | `metadata.${string}`;
```

Helpers exported alongside it: `validateSortBy(sortBy)`, `validateSortType(sortType)`, `validateMetadataPropertyName(name)`. `metadata.*` sorts require alphanumeric/underscore property names (validated, throws otherwise). `SortDirection = "asc" | "desc"`, `SortType = "auto" | "numeric" | "text" | "boolean" | "timestamp"`.

## ⚠️ Agora ranking algorithms (divergence)

Four ranking modes upstream does not have, implemented server-side (`lib/ranking.ts`). They are **additive and backward-compatible** — the stock sorts are untouched:

| `sortBy` | Algorithm | Use for |
|---|---|---|
| `decay` | true exponential half-life | time-sensitive feeds where freshness should fade smoothly |
| `gravity` | Hacker News gravity formula | classic "hot" with age penalty |
| `wilson` | Wilson confidence interval | ranking by up/down votes with small-sample confidence |
| `bayesian` | Bayesian shrunk mean | rating-style scores that shouldn't be dominated by low-count outliers |

### Tuning: `rankParams`, `rankAnchor`, `rerank`

`fetchEntities` (and the entity-list fetch path) gained three optional pass-through scalars:

- **`rankParams`** — a **JSON string** of numeric tunables, e.g. `'{"halfLifeHours":12}'` for `decay`, or gravity/Wilson/Bayesian constants. (It's a string, not an object — `JSON.stringify` your params.)
- **`rankAnchor`** — pins the decay clock across paginated requests so page 2 ranks against the same "now" as page 1. The server echoes it back; feed it into subsequent pages for stable pagination.
- **`rerank`** — opt into the server's re-rank webhook for custom server-side reordering.

```tsx
const { setSortBy, fetchNextPage } = useEntityListActions();

setSortBy("decay");
// pass tunables + anchor through the fetch options:
fetchNextPage({
  rankParams: JSON.stringify({ halfLifeHours: 12 }),
  rankAnchor,   // echo the value the server returned on the previous page
});
```

> If you set a ranking `sortBy` but pass no `rankParams`, the server applies sensible defaults. Always thread `rankAnchor` through paginated `decay`/`gravity` requests, or later pages will re-rank against a drifting clock and you'll see entities reshuffle between pages.

## Related

- Single entity + its social features: see **[social-core.md](social-core.md)**.
- User-curated collections of entities (not feeds): `useCollections()` / `useCollectionsActions()` — see [api-surface.md](api-surface.md) › Collections.
- Space (community) discovery feeds: `useSpaceList()` / `useSpaceListActions()`.
