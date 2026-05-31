# Advanced Features: Spaces, Chat, Connections & Follows

These domains are **stock upstream Replyke** — no Agora divergences. So this file is deliberately thin: it gives you the **provider topology, the hook taxonomy, and the footguns** that aren't obvious from a flat hook list. For exact arguments and return shapes, use the **lookup ladder** in [SKILL.md](../SKILL.md): [api-surface.md](api-surface.md) to find the symbol → the installed `.d.ts` for signatures → (optionally) the Replyke MCP / `docs.replyke.com` for prose. The `→` pointers below give the MCP/docs path; offline, the same lives under `node_modules/@agora-sdk/core/dist/esm/hooks/<domain>/`. Apply the usual rule: import from `@agora-sdk/*`, never `@replyke/*`.

---

## Spaces (communities)

A space is a community with members, roles, moderation, rules, and digests. Scope with `SpaceProvider`, then read with `useSpace()` / `useSpaceData()`.

```tsx
import { SpaceProvider, useSpace } from "@agora-sdk/react-js";

<SpaceProvider spaceId="space_…">   {/* one of: space | spaceId | shortId | slug (+ optional include) */}
  <SpaceHome />
</SpaceProvider>
```

Hook families (all standalone unless noted) — pick the family, then look up specifics:
- **Fetch:** `useFetchSpace`, `useFetchSpaceByShortId`, `useFetchSpaceBySlug`, `useFetchManySpaces`, `useFetchSpaceBreadcrumb`, `useFetchSpaceChildren` (spaces nest — hence breadcrumbs/children).
- **Lifecycle:** `useCreateSpace`, `useUpdateSpace`, `useDeleteSpace`, `useCheckSlugAvailability`.
- **Membership:** `useJoinSpace`, `useLeaveSpace`, `useCheckMyMembership`, `useFetchSpaceMembers`, `useFetchSpaceTeam`, `useFetchUserSpaces`.
- **Member management:** `useUpdateMemberRole`, `useApproveMember`, `useDeclineMember`, `useRemoveMember`, `useUnbanMember` (approve/decline imply a request-to-join flow with `SpaceMemberStatus`).
- **Moderation:** `useModerateSpaceEntity`, `useModerateSpaceComment`, `useSpacePermissions`; reports via `useFetchModeratedReports`, `useHandleSpaceEntityReport`, `useHandleSpaceCommentReport`.
- **Rules & digests:** `useCreateRule`/`useUpdateRule`/`useDeleteRule`/`useFetchRule`/`useFetchManyRules`/`useReorderRules`; `useFetchDigestConfig`/`useUpdateDigestConfig`.
- **Discovery feed:** `useSpaceList()` / `useSpaceListActions()` (same paginated-list shape as entity lists — see [feeds.md](feeds.md)).

Gotcha: spaces are **hierarchical** (parent/child + breadcrumbs). If you build space navigation, use `useFetchSpaceBreadcrumb` / `useFetchSpaceChildren` rather than flattening. → `ls /v7/hooks/spaces`, `cat /v7/data-models/space.mdx /v7/data-models/space-member.mdx`.

---

## Chat (the one with real topology + a socket footgun)

Chat uses **three nested providers**, each narrowing scope. Don't skip levels:

```
ChatProvider                       (no props — owns the socket + unread state, wrap once near the root)
  └─ ConversationProvider          ({ conversationId, onDeleted? } — one conversation)
       └─ MessageThreadProvider    ({ messageId, conversationId } — a threaded reply view)
```

```tsx
import { ChatProvider, ConversationProvider, useChatMessages, useSendMessage } from "@agora-sdk/react-js";

<ChatProvider>
  <ConversationProvider conversationId="conv_…">
    <MessageList />   {/* useChatMessages() */}
    <Composer />      {/* useSendMessage() */}
  </ConversationProvider>
</ChatProvider>
```

Context accessors: `useChatContext`, `useConversationContext`, `useMessageThreadContext`.

Hook taxonomy:
- **Conversations:** `useConversations` (list), `useConversation` / `useConversationData` (scoped), `useFetchConversation`, `useCreateDirectConversation` (DM), `useFetchSpaceConversation`, `useUpdateConversation`, `useDeleteConversation`, `useConversationMembers`.
- **Messages:** `useChatMessages` (paginated), `useSendMessage`, `useEditMessage`, `useDeleteMessage`, `useToggleReaction`, `useReportMessage`, `useMessageThread`.
- **Real-time:** `useChatSocket` (connection state), `useTypingIndicator`.
- **Unread:** `useTotalUnreadCount`, `useUnreadConversationCount`, `useMarkConversationAsRead`.

⚠️ **Socket footgun (ties back to a divergence):** the chat socket origin comes from `getSocketUrl()`, which derives from the `baseUrl` you inject into `ReplykeProvider` (stripped to its origin). If chat silently fails to connect, the cause is almost always a missing/wrong `baseUrl` — not the chat code. See [setup.md](setup.md). `ChatProvider` owns the single socket connection and the unread bookkeeping, so mount it **once** high in the tree, not per-conversation. → `ls /v7/hooks/chat`, `cat /v7/data-models/conversation.mdx /v7/data-models/chat-message.mdx`.

---

## Connections vs Follows (don't mix these up)

Two distinct relationship primitives — picking the wrong one is the most common mistake here:

| | **Follows** | **Connections** |
|---|---|---|
| Shape | one-directional (A follows B) | mutual, request→accept (like "friends") |
| Use for | feeds, creator/audience | DMs, friend graphs, mutual visibility |
| Create | `useFollowUser` | `useRequestConnection` → `useAcceptConnection` / `useDeclineConnection` |

**Follows:** `useFollowUser`, `useUnfollowByFollowId`, `useUnfollowUserByUserId`, `useFollowManager`, `useFetchFollowStatus`, `useFetchFollowers`, `useFetchFollowing`, and counts `useFetchFollowersCount`/`useFetchFollowingCount` (+ `…ByUserId` variants). → `ls /v7/hooks/follows`.

**Connections:** `useRequestConnection`, `useAcceptConnection`, `useDeclineConnection`, `useRemoveConnection`, `useConnectionManager`; fetch `useFetchConnections(+ByUserId)`, `useFetchConnectionStatus`, `useFetchSentPendingConnections`, `useFetchReceivedPendingConnections`; counts `useFetchConnectionsCount(+ByUserId)`. Types: `Connection`, `EstablishedConnection`, `PendingConnection`, `ConnectionStatus`. → `ls /v7/hooks/connections`, `cat /v7/data-models/connection.mdx /v7/data-models/follow.mdx`.

---

## Also available (see [api-surface.md](api-surface.md) for the full list)

- **App notifications:** `useAppNotifications()` / `useAppNotificationsActions()`. → MCP/docs `/v7/hooks/app-notifications`.
- **Search & AI:** `useSearchContent`, `useSearchUsers`, `useSearchSpaces`, `useAskContent` (semantic Q&A over content; resolves the API host from `baseUrl` at call time). → MCP/docs `/v7/semantic-search-ai`.
- **Storage:** `useUploadFile`, `useUploadImage` (types `RNFile`, `UploadResponse`, `UploadFileOptions`). → MCP/docs `/v7/hooks/storage`.
- **Users & project:** `useUser`/`useUserActions`, `useFetchUserByUsername`, `useCheckUsernameAvailability`, `useUserMentions`; `useProject`/`useProjectData`.
