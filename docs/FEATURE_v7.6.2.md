# What's new in v1.4.0 (upstream v7.6.2) — consumer guide

This release pulls a large batch of new functionality into `@agora-sdk/*` from the upstream v7.6.2
sync. This guide is for **app developers consuming the SDK** — how to use each new feature, with
copy-pasteable examples.

> **Server support required.** Every feature here talks to an Agora server. If your server is older,
> a feature may be a no-op or 404 until the matching endpoints ship. See the server-side counterpart,
> `agora-server/docs/FEATURE_MIGRATION.md`.

**At a glance**

| Feature | New API | You need to… |
|---|---|---|
| 📲 Push notifications | `usePushRegistration` + a platform adapter | opt in explicitly + install a peer dep per platform |
| 📅 Events | `EventProvider` / `useEvent`, `useEventData`, `useFetchManyEventsWrapper`, RSVP/invite/host hooks | adopt the provider+hooks like entities |
| 💬 Comment sorting | `defaultSortBy` / `defaultSortDir` + `controversial` | migrate off deprecated `new`/`old` |
| 📰 Entity feed sorting | `sortBy: "createdAt"` (+ `sortDir`) | migrate off deprecated `new` |
| 🔴 Live conversation list | automatic in `ChatProvider` | nothing — you get it for free |

---

## 1. 📲 Push notifications

OS-level push (FCM / APNs / Web Push) delivered when your app is backgrounded or closed. This is
**opt-in and explicit** — requesting push permission should never happen silently, so the SDK never
auto-registers. You call `register()` yourself (e.g. behind a "Turn on notifications" toggle).

### Pick the adapter for your platform

Each platform package exports an adapter; you pass it to `usePushRegistration`:

| Platform | Import | Peer dep you must install |
|---|---|---|
| Web | `import { webPushTokenAdapter } from "@agora-sdk/react-js"` | none (uses the browser Push API) |
| Bare React Native | `import { reactNativePushTokenAdapter } from "@agora-sdk/react-native"` | `@react-native-firebase/messaging` |
| Expo | `import { expoPushTokenAdapter } from "@agora-sdk/expo"` | `expo-notifications` |

The native deps are **peer + dev** dependencies — they are not bundled. Only an app that imports the
native adapter installs them. (Web push additionally requires a **service worker** registered in your
app — a browser requirement for `PushManager`.)

### Usage

```tsx
import { usePushRegistration } from "@agora-sdk/core"; // also re-exported from your platform package
import { webPushTokenAdapter } from "@agora-sdk/react-js";

function NotificationsToggle() {
  const { register, unregister, registering, unregistering } =
    usePushRegistration(webPushTokenAdapter);

  return (
    <button
      disabled={registering || unregistering}
      onClick={async () => {
        const granted = await register();
        if (!granted) {
          // permission denied, or the adapter couldn't produce a token — both are
          // expected, non-error outcomes (register resolves false, doesn't throw)
          alert("Push permission was not granted.");
        }
      }}
    >
      Enable push notifications
    </button>
  );
}
```

**Return values** (`UsePushRegistrationValues`):

| Field | Type | Notes |
|---|---|---|
| `register` | `() => Promise<boolean>` | Requests permission → mints a token via the adapter → registers it server-side. Resolves `false` (no throw) if permission is denied or no token is available. **Throws** only on a failed API call. |
| `unregister` | `() => Promise<void>` | Deregisters this device's token. No-op if there's nothing to deregister. |
| `registering` / `unregistering` | `boolean` | In-flight flags for disabling UI. |

**Requirements:** the hook must run inside `ReplykeProvider` with an **authenticated user** —
`register`/`unregister` throw if there's no `projectId` or signed-in user. Registration is per
**device**, independent of session lifetime; the SDK does not auto-deregister on sign-out, so call
`unregister()` yourself if a user toggles push off.

---

## 2. 📅 Events

A full events domain: create events, gather RSVPs (`going` / `maybe` / `not_going`), manage an
invitee list, and assign multiple hosts. It follows the same **provider + hooks** pattern as entities.

### A single event: `EventProvider` + `useEvent`

Wrap a subtree with `EventProvider` (pass either a hydrated `event` or an `eventId` to fetch), then
read it anywhere inside with `useEvent()`:

```tsx
import { EventProvider, useEvent } from "@agora-sdk/core";

<EventProvider eventId={eventId} include={["user", "userRsvp"]}>
  <EventScreen />
</EventProvider>;

function EventScreen() {
  const { event, setRsvp, withdrawRsvp, updateEvent, cancelEvent } = useEvent();
  if (!event) return null;

  return (
    <>
      <h1>{event.title}</h1>
      <p>{event.rsvpCounts.going} going · {event.rsvpCounts.maybe} maybe</p>

      <button onClick={() => setRsvp?.("going")}>I'm going</button>
      <button onClick={() => setRsvp?.("maybe")} disabled={!event.allowMaybe}>Maybe</button>
      <button onClick={() => withdrawRsvp?.()}>Withdraw</button>
    </>
  );
}
```

`useEvent()` returns the `useEventData` surface: `event`, `setEvent`, `updateEvent({ update })`,
`deleteEvent()`, `cancelEvent()`, `setRsvp(status)`, `withdrawRsvp()`. (`include` accepts
`"user" | "space" | "files" | "userRsvp"`.)

You can also drive a single event without the provider via `useEventData({ eventId })` or
`useEventData({ event })`.

### A list of events: `useFetchManyEventsWrapper`

```tsx
import { useFetchManyEventsWrapper } from "@agora-sdk/core";

function UpcomingEvents() {
  const {
    events, loading, hasMore, loadMore,
    sortBy, setSortBy, sortDir, setSortDir, refresh,
  } = useFetchManyEventsWrapper({
    timeWindow: "upcoming",          // "upcoming" | "ongoing" | "past"
    defaultSortBy: "startTime",      // "startTime" | "going"
    defaultSortDir: "asc",           // "asc" | "desc"
    limit: 20,
    // optional filters: spaceId, hostId, type, status, startsAfter/Before,
    // myRsvp, locationFilters, titleFilters, descriptionFilters, include
  });

  return (
    <>
      {events.map((e) => <EventCard key={e.id} event={e} />)}
      {hasMore && <button disabled={loading} onClick={loadMore}>Load more</button>}
    </>
  );
}
```

Call `refresh()` after creating or cancelling an event to re-query from page 1.

### Mutations

```tsx
import {
  useCreateEvent, useUpdateEvent, useDeleteEvent, useCancelEvent,
  useSetRsvp, useWithdrawRsvp,
  useAddHost, useRemoveHost,
  useAddInvite, useRemoveInvite,
  useFetchInvitees, useFetchEventRsvps,
} from "@agora-sdk/core";

const createEvent = useCreateEvent();
const newEvent = await createEvent({
  title: "Community Call",
  startTime: new Date("2026-07-01T18:00:00Z").toISOString(),
  type: "online",                 // "online" | "physical" | "hybrid"
  url: "https://meet.example/abc",
  visibility: "public",           // "public" | "members" | "invite"
  allowMaybe: true,
  guestListVisible: true,
  capacity: 100,                  // null/omit = unlimited
  hostIds: [coHostUserId],        // creator is added automatically
  // cover / gallery image uploads are supported via the same hook
});
```

- **Hosts** are managed *only* via `useAddHost` / `useRemoveHost` (`{ userId }`) — not through
  `updateEvent`. You can't remove the last host.
- **Invites** (`useAddInvite` / `useRemoveInvite`, `{ userId }`) are host-only; removing an invite
  also drops that user's RSVP. `useFetchInvitees` is host-only.
- **RSVP list** (`useFetchEventRsvps`) is visible to hosts always, and to others only when
  `guestListVisible` is `true`.

> Authorization (who may update/cancel/host/invite) is enforced **server-side** — calls may reject
> with `403`. Check your server's rules.

---

## 3. 💬 Comment sorting

Comments gain a direction-aware `createdAt` sort and a `controversial` sort. The old `new`/`old`
values are **deprecated**.

### Sort values

`CommentsSortByOptions` = `"createdAt" | "top" | "controversial" | "new" | "old"`

| Value | Meaning |
|---|---|
| `createdAt` | Chronological; pair with `sortDir` (`"desc"` = newest first, default). **Use this.** |
| `top` | Highest-scored first. |
| `controversial` | High-engagement / split-reaction comments first. |
| ~~`new`~~ | **Deprecated** → use `createdAt` + `sortDir: "desc"`. Removed in v8. |
| ~~`old`~~ | **Deprecated** → use `createdAt` + `sortDir: "asc"`. Removed in v8. |

### Via the comment section provider

```tsx
import { CommentSectionProvider, useCommentSection } from "@agora-sdk/core";

<CommentSectionProvider
  entity={entity}
  defaultSortBy="createdAt"   // default is "top" in the full comment section
  defaultSortDir="desc"
>
  <Comments />
</CommentSectionProvider>;

function Comments() {
  const { comments, sortBy, setSortBy, sortDir, setSortDir } = useCommentSection();

  return (
    <>
      <select value={sortBy ?? "top"} onChange={(e) => setSortBy(e.target.value as any)}>
        <option value="top">Top</option>
        <option value="createdAt">Newest</option>
        <option value="controversial">Controversial</option>
      </select>
      {sortBy === "createdAt" && (
        <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}>
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </button>
      )}
      {/* render comments */}
    </>
  );
}
```

The same `defaultSortBy` / `defaultSortDir` props and `sortBy`/`setSortBy`/`sortDir`/`setSortDir`
values are available on `useEntityComments` if you build your own comment UI. `sortDir` is only
meaningful for `createdAt`.

---

## 4. 📰 Entity feed sorting

The entity feed gains a first-class, direction-aware `createdAt` sort; the old `new` value is
**deprecated** (use `createdAt` + `sortDir`).

```tsx
import { useEntityList } from "@agora-sdk/core";

function Feed() {
  const { entities, sortBy, sortDir, fetchEntities, loadMore, hasMore } = useEntityList();

  return (
    <>
      <button onClick={() => fetchEntities({}, { sortBy: "createdAt", sortDir: "desc" })}>
        Newest
      </button>
      <button onClick={() => fetchEntities({}, { sortBy: "createdAt", sortDir: "asc" })}>
        Oldest
      </button>
      <button onClick={() => fetchEntities({}, { sortBy: "hot" })}>Hot</button>
      {/* render entities; loadMore() when hasMore */}
    </>
  );
}
```

`EntityListSortByOptions` includes the upstream values `createdAt`, `hot`, `top`, `controversial`,
the deprecated `new`, `metadata.<field>`, **plus Agora's ranking engine** (`decay`, `gravity`,
`wilson`, `bayesian` with `rankParams`/`rankAnchor`). `sortDir` is meaningful for `createdAt` and
`metadata.<field>`; the score-based algorithms order themselves.

> **Migration:** replace `sortBy: "new"` with `sortBy: "createdAt", sortDir: "desc"`. The server
> still accepts `new` (with deprecation headers) until v8.

---

## 5. 🔴 Live conversation list

The chat **inbox** is now live. If you already use `ChatProvider` / `useConversations`, **you get
this for free — no code change.** What you now get automatically:

- Conversation **previews reorder in real time** as new messages arrive (via the existing socket),
  including conversations not currently on screen.
- **Unread counts/badges update live** instead of only on refetch.
- New conversations you're added to **appear instantly**.
- On **socket reconnect**, the list and the global unread badge **reconcile automatically** (the SDK
  reloads the first page and re-fetches the authoritative unread summary), so a dropped connection
  doesn't leave a stale inbox.

```tsx
import { useConversations } from "@agora-sdk/core";

const { conversations, loadMore, hasMore, refresh, createGroup } = useConversations();
// `conversations` stays ordered by most-recent activity and updates live.
```

This relies on the server emitting conversation/message socket events to each member; if your inbox
doesn't update live, the server side of this feature may not be deployed yet (see
`agora-server/docs/FEATURE_MIGRATION.md` §5).

---

## Deprecations to act on

| Deprecated | Replace with | Removed |
|---|---|---|
| Comment `sortBy: "new"` | `sortBy: "createdAt", sortDir: "desc"` | v8 |
| Comment `sortBy: "old"` | `sortBy: "createdAt", sortDir: "asc"` | v8 |
| Entity `sortBy: "new"` | `sortBy: "createdAt", sortDir: "desc"` | v8 |

The server keeps accepting the deprecated values (responding with deprecation headers) until v8, so
there's no rush — but new code should use `createdAt` + `sortDir`.

---

## See also

- `agora-server/docs/FEATURE_MIGRATION.md` — the server-side contract for all of the above.
- `CHANGELOG.md` — the full v1.4.0 entry.
- `SYNCING.md` / `CLAUDE.md` — how this fork tracks upstream Replyke and where it diverges.
