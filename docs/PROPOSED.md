# Proposed SDK changes

Forward-looking proposals for the forked `@agora-sdk/*` that surfaced while building the
**`agora-demo`** compatibility harness. The SDK-side counterpart to the Agora server's
`docs/PROPOSED.md` backlog: each item is a fork change the demo needs (or a latent gap), kept here
until implemented so the upstream-merge cost is visible up front. None are implemented yet.

Every item is tagged by its **upstream-merge class** — the constraint that governs this fork (see
`SYNCING.md`):

- 🟢 **Upstream-PR candidate** — a generic fix to a Replyke inconsistency; contributing it upstream
  *dissolves* the divergence on the next merge (cf. `SYNCING.md` §4, entity `include` passthrough).
- 🟡 **Scripted / derived** — produced by a re-runnable script (cf. the `@agora-sdk/*` rename),
  cheap to re-apply, low merge risk.
- 🔴 **Hand-edit divergence** — a genuine behavioral/contract fork on the `agora` branch; a likely
  merge-conflict spot that must be re-applied by hand with a `Modified from original @replyke/core`
  header (Apache-2.0 §4(b)) and a `SYNCING.md` entry.

---

## 1. Surface a newly-created conversation to its members in realtime

**Tag:** 🔴 Hand-edit divergence · **Priority:** Medium · **Effort:** Small · **Depends on:** server `docs/PROPOSED.md` §5 (the `conversation:created` emit)

**Problem.** When user A starts a chat with user B, B's conversation list stays stale until a manual
refresh / remount — A's new chat doesn't appear on B's screen. On the SDK side there are two gaps:

- `core/src/context/chat-context.tsx` owns the chat socket and maintains the conversation-list slice
  via handlers for `message:created`, `message:updated`, `conversation:updated`, … — but there is
  **no handler for a brand-new conversation arriving for the current user**.
- `core/src/hooks/chat/conversations/useConversations.tsx` only fetches on mount and exposes a
  manual `refresh()`; it never reacts to socket activity.

The stock Replyke socket contract (`core/src/types/socket.ts` `ServerToClientEvents`) has no event
for this either — so it's a net-new event, not just an unhandled one.

**Precedent (already shipped, secure chat).** The secure-chat SDK (`agora-sdk-plus`) solved the
identical UX gap: `packages/secure-chat/core/src/hooks/useSecureConversations.tsx` listens for the
server's `secure:welcome` push and calls `refresh()`, so a new secure DM appears on the peer's screen
instantly. This item is the **plaintext-chat port of that fix** — same shape, different transport.

**Demo workaround.** None today. The only client-only option is interval polling of `refresh()` in
`agora-demo/src/Chat.tsx` (the pattern `Connections.tsx` / `Follows.tsx` already use) — fidelity-
preserving but not realtime, and it pushes list-refetch load that the event makes unnecessary.

**Blocked on the server.** Unlike secure chat — where the DS already pushed `secure:welcome` — the
plaintext server currently emits **nothing reachable** to B on conversation create (see server
`docs/PROPOSED.md` §5: DM/group create emit nothing; member-add emits `member:joined` only to the
conversation room B hasn't joined). So this SDK change has nothing to listen to until the server emit
lands. **Land them together.**

**Proposed change.** Once the server emits `conversation:created` to the recipient's per-user room:

1. **`core/src/types/socket.ts`** — add to `ServerToClientEvents`:
   ```ts
   // Rich-payload variant (recommended; mirrors the server's list-item shape):
   "conversation:created": (conversation: ConversationPreview) => void;
   // Lightweight variant (if the server emits only an id):
   // "conversation:created": (p: { conversationId: string }) => void;
   ```
2. **`core/src/context/chat-context.tsx`** — register one handler in the main socket effect, beside
   the existing ones. It already imports `upsertConversationPreview` from `chatSlice`:
   ```ts
   socket.on("conversation:created", (conversation) => {
     dispatch(upsertConversationPreview({
       conversationId: conversation.id,
       patch: conversation,
     }));
   });
   ```
   (Lightweight variant: trigger a conversation-list refetch instead — but `chat-context` doesn't own
   the list fetch, so prefer the rich payload so the upsert is self-contained. If only an id is
   available, add a tiny `setConversationListStale` flag to `chatSlice` that `useConversations`
   watches and refetches on.)

**Zero demo changes.** `agora-demo/src/Chat.tsx` reads the list through `useConversations`, which
reads the Redux slice — so updating the slice in `chat-context` makes the new conversation appear with
no demo edit. (Same division of labor as secure chat: the fix lived in the SDK hook, not the demo.)

**Files.** `core/src/types/socket.ts` (event type), `core/src/context/chat-context.tsx` (handler —
already a `Modified from original` file for the socket-origin repoint, so this extends an existing
divergence rather than introducing a new flagged file). Rebuild **both** `core` and `react-js` dists
(`pnpm build-all`) — the demo's local-fork alias (`agora-demo/vite.config.ts`) activates only when
*both* `core/dist/esm/index.js` and `react-js/dist/esm/index.js` exist.

**Merge note.** Net-new socket event the stock SDK doesn't have → a `SYNCING.md` hand-edit
divergence. It pairs with the server's §2 per-user-channel work (realtime connections/notifications),
which already anticipates "a subscription in `chat-context`/a new context" as a 4th divergence — fold
this handler into that same entry so the fork carries **one** realtime-events divergence, not two.
Not an upstream-PR candidate: it's specific to the Agora server's emit, not a generic Replyke fix.
