# Server spec — user↔user comment notifications

**Audience:** Agora server team
**From:** Agora SDK (`@agora-sdk/*`)
**Status:** Proposed — SDK side is already built; this describes what the server must provide.

---

## TL;DR

The SDK already has the **entire client side** of user-to-user comment notifications: the data
model, the typed notification shapes, and the read path (`useAppNotifications` — fetch, paginate,
unread count, mark-as-read, mark-all-read, display templates). Nothing new is needed in the SDK to
*show* these notifications.

What the server needs to provide is two things:

1. **Generation (required):** create notification rows when a comment event happens (someone
   comments on your entity, replies to your comment, or @mentions you in a comment). The SDK's
   existing REST read path will then surface them.
2. **Real-time delivery (the gap):** push a `notification:created` event over the **existing
   socket** to the recipient so the bell/badge updates live, instead of only on the next REST
   poll/refetch.

Item 1 makes the feature *work*. Item 2 makes it *live*. They can ship independently — generation
first, real-time second.

---

## 1. What the SDK already provides (no server action needed here)

The SDK reads notifications through these endpoints (already implemented client-side, calling the
Agora server). The server presumably already serves these for other notification types
(follows, connections, etc.); comment notifications just need to be *generated* into the same store.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/:projectId/app-notifications?page=&limit=` | `PaginatedResponse<UnifiedAppNotification>` |
| `GET` | `/:projectId/app-notifications/count` | `number` (unread count) |
| `PATCH` | `/:projectId/app-notifications/:notificationId/mark-as-read` | 200 (body ignored) |
| `PATCH` | `/:projectId/app-notifications/mark-all-as-read` | `{ markedAsRead: number }` |

Every notification row the SDK consumes has this base shape:

```ts
{
  id: string;          // uuid
  userId: string;      // the RECIPIENT's user id
  type: AppNotificationType;
  isRead: boolean;
  metadata: Record<string, any>;  // per-type, see below
  createdAt: string;   // ISO 8601 timestamp string
}
```

---

## 2. Notification generation (required)

The SDK already defines three comment-related notification types. The server must create a row of
the matching type, addressed to the right recipient, with the exact `metadata` the SDK expects.
(Source of truth: `packages/core/src/interfaces/models/AppNotification.ts`.)

### Trigger → notification mapping

| Trigger | `type` | Recipient (`userId`) | `action` |
|---|---|---|---|
| User comments on an entity | `entity-comment` | Entity owner | `open-comment` |
| User replies to a comment | `comment-reply` | Parent comment's author | `open-comment` |
| User @mentions someone in a comment | `comment-mention` | Each mentioned user | `open-comment` |

> "User↔user" note: the *initiator* is the actor (commenter/replier); the *recipient* (`userId`)
> is the entity owner / parent author / mentioned user. These are distinct users — see suppression
> rules below.

### Required `metadata` per type

**`entity-comment`**
```ts
{
  entityId: string;
  entityShortId: string;
  entityTitle: string | null;
  entityContent: string | null;
  commentId: string;
  commentContent: string | null;
  initiatorId: string;        // the commenter
  initiatorName: string | null;
  initiatorUsername: string | null;
  initiatorAvatar: string | null;
}
```

**`comment-reply`** — same as above, **plus**:
```ts
{
  // ...all entity-comment fields, where commentId/commentContent describe the PARENT comment...
  replyId: string;            // the new reply
  replyContent: string | null;
}
```

**`comment-mention`** — same fields as `entity-comment` (`commentId`/`commentContent` describe the
comment containing the mention).

> The SDK turns this metadata into display text via consumer-supplied templates (e.g.
> `"$initiatorName commented on your post"`). The server does **not** need to produce display
> strings — just the structured metadata above. Populating `initiatorName`/`username`/`avatar`
> (rather than leaving them null) lets templates render without an extra lookup.

### Suppression / correctness rules (please confirm)

- **No self-notification.** Don't create a row when the initiator *is* the recipient (commenting on
  your own entity, replying to yourself, mentioning yourself).
- **Reply vs. entity-comment, not both.** A reply to a comment should generate `comment-reply` to
  the parent author; decide whether it *also* generates `entity-comment` to the entity owner (we'd
  suggest: yes to the entity owner *and* the parent author, deduped if they're the same user — one
  row, prefer `comment-reply`).
- **Mention de-dup.** If a comment both replies to user A and @mentions user A, send one row (prefer
  the more specific `comment-mention`, or `comment-reply` — your call; please document which).
- **Deleted/edited comments.** If a comment is deleted, decide whether to retract/hide the
  notification. Not required for v1, but note the chosen behavior.

---

## 3. Real-time delivery (the gap)

Today the SDK only learns about new notifications by **refetching** (`useAppNotifications` re-fetches
on mount and polls the unread count). There is **no socket push** for notifications — the socket
event surface is currently 100% chat-scoped (`packages/core/src/types/socket.ts`).

We want the bell/badge to update the instant a notification is created, riding the **socket the
client already opens** — no new connection.

### How the socket already works (context for the server)

The SDK opens **one** socket.io connection per authenticated user
(`packages/core/src/context/chat-context.tsx`):

```ts
io(getSocketUrl(), {
  auth:  { token: accessToken },  // server can derive the userId from this
  query: { projectId },
  autoConnect: true,
})
```

So the server already authenticates each socket by access token and knows the connecting user and
project. A user may have **multiple** sockets (multiple tabs/devices).

### What we're asking the server to add

1. **Per-recipient room.** On socket connect (after auth), join each socket to a user-scoped room,
   e.g. `user:<userId>` (scoped per project if rooms aren't already project-namespaced). This lets
   the server fan a notification out to all of a user's devices without tracking socket ids.

2. **New server→client event:** emit when a notification row is created for that user.

   ```ts
   // Server → Client
   "notification:created": (notification: UnifiedAppNotification) => void;
   ```

   Payload = the **full notification row** (same shape the REST list returns), so the client can
   prepend it to the list and bump the unread badge with no follow-up fetch.

3. **(Optional but nice) unread-count signal.** If you'd rather not have the client recompute, also
   emit:

   ```ts
   "notification:unread_count": (payload: { unreadCount: number }) => void;
   ```

   Otherwise the client will derive the badge by incrementing locally and/or refetching
   `/app-notifications/count`. Either is fine — tell us which so we wire the SDK accordingly.

> SDK-side follow-up (our work, not yours): add these two events to the socket type union and have
> the notifications slice handle them. We just need the event **names, payload shapes, and room
> semantics** locked so both sides match. The two snippets above are our proposal — push back if a
> different shape is easier server-side.

---

## 4. Concrete contract summary (what both sides must agree on)

**REST (already consumed by SDK — confirm comment types flow through these):**
- `GET /:projectId/app-notifications` → paginated `UnifiedAppNotification[]`
- `GET /:projectId/app-notifications/count` → unread `number`
- `PATCH /:projectId/app-notifications/:id/mark-as-read`
- `PATCH /:projectId/app-notifications/mark-all-as-read` → `{ markedAsRead }`

**Socket (new):**
- Room: `user:<userId>` (per device, per project)
- `notification:created` → full `UnifiedAppNotification`
- `notification:unread_count` (optional) → `{ unreadCount: number }`

**Notification rows (new generation):** `entity-comment`, `comment-reply`, `comment-mention`
with the metadata shapes in §2.

---

## 5. Open questions for the server team

1. Does the server **already generate** `entity-comment` / `comment-reply` / `comment-mention`
   rows, or only the non-comment types? (Determines whether §2 is "build" or "already done.")
2. Confirm the **room model**: are socket rooms project-namespaced today? What's the preferred
   per-user room key?
3. **Unread count**: push it over the socket, or let the client refetch/increment?
4. Suppression rules in §2 — confirm the self-notify, reply-vs-entity-comment, and mention-dedup
   behavior.
5. Any **rate-limiting / collapsing** desired for high-volume threads (e.g. "5 people commented")?
   The SDK already has milestone/collapsed types for *reactions* but **not** for comments — out of
   scope unless you want it.

---

## 6. Out of scope (for this round)

- Push notifications (APNs/FCM) — this spec is in-app notifications only.
- Email/digest delivery.
- Comment *content* real-time (live comment threads) — separate concern; this spec is strictly the
  notification bell/badge.
- New SDK notification *types* — we're using the three that already exist.
