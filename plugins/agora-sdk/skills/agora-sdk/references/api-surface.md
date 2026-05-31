# Agora SDK — Bundled API Surface

A self-contained index of everything exported from `@agora-sdk/core` (re-exported by every platform package), so the skill works with **no Replyke MCP and no network**. Generated from the `v1.1.1` public surface (`packages/core/src/index.ts` → `dist/esm/index.d.ts`).

**This is a map, not a manual.** It tells you *what exists* and *which domain it's in*. For exact argument and return shapes, read the version-exact declarations the consuming app already has on disk:

```bash
# always available — no MCP, no network, exactly the version installed:
cat node_modules/@agora-sdk/core/dist/esm/index.d.ts          # full surface
# drill into a hook's own .d.ts, e.g.:
cat node_modules/@agora-sdk/core/dist/esm/hooks/auth/useAuth.d.ts
```

> Naming convention (learn once): `use<Feature>()` = scoped read, `use<Feature>Actions()` = scoped mutate, `useFetch<Thing>()` / `useCreate<Thing>()` = standalone. `<Foo>Props` = a hook's argument type, `Use<Foo>Values`/`...Return` = its return type. ⚠️ marks an Agora divergence — see [SKILL.md](../SKILL.md).

---

## Providers & context (`./context`)
`ReplykeProvider`, `ReplykeIntegrationProvider`, `EntityProvider`, `CommentSectionProvider`, `SpaceProvider`, `ChatProvider`, `ConversationProvider`, `MessageThreadProvider`
Accessors: `useChatContext`, `useConversationContext`, `useMessageThreadContext`
Types: `ChatProviderProps`, `ConversationProviderProps` (`{conversationId, onDeleted?}`), `MessageThreadProviderProps` (`{messageId, conversationId}`), `ChatContextValue`, `ConversationContextValue`, `MessageThreadContextValue`

## Redux integration mode (`./store/integration`)
`replykeReducers`, `replykeApiReducer`, `replykeMiddleware`, `replykeApi`, type `ReplykeState`
Platform-wrapper internals: `useReplykeDispatch`, `useReplykeSelector`, `setTokens`, `setInitialized`, `selectAccessToken`, `requestNewAccessTokenThunk`

## Auth (`./hooks/auth`)
Hooks: `useAuth`, `useRequestPasswordReset`, `useSendVerificationEmail`, `useVerifyEmail`
Types: `UseAuthValues`, `SignUpWithEmailAndPasswordProps`, `SignInWithEmailAndPasswordProps`, `ChangePasswordProps`, ⚠️ `SignUpResult`, `RequestPasswordResetProps`, `SendVerificationEmailProps`, `VerifyEmailProps`
→ details in [auth.md](auth.md)

### Multi-account
`useAccountSync`, `useAccounts`, `useSwitchAccount`, `useAddAccount`, `useRemoveAccount`, `useSignOutAll`
Types: `UseAccountsReturn`, `UseSwitchAccountReturn`, `UseAddAccountReturn`, `UseRemoveAccountReturn`, `UseSignOutAllReturn`, `AccountStorage`, `AccountSummary`, `AccountEntry`, `AccountMap`, const `MAX_ACCOUNTS`

### OAuth
`useOAuthIdentities` (+ types `OAuthIdentity`, `UseOAuthIdentitiesReturn`). Web redirect flow: `useOAuthSignIn` lives in **`@agora-sdk/react-js`** (not core) — see [auth.md](auth.md).

### Crypto (dev only)
`useSignTestingJwt` (+ `SignTestingJwtProps`) — never ship to production.

## Current user (`./hooks/user`)
`useUser`, `useUserActions` (+ `UseUserProps`, `UseUserValues`, `UpdateUserParams`)

## Other users (`./hooks/users`)
`useFetchUser`, `useFetchUserByForeignId`, `useFetchUserByUsername`, `useCheckUsernameAvailability`, `useFetchUserSuggestions`, `useUserMentions` (+ matching `*Props`/`*Values` types)

## Project (`./hooks/projects`)
`useProject`, `useProjectData`

## Entities (`./hooks/entities`)
`useEntity`, `useEntityData`, `useCreateEntity`, `useUpdateEntity`, `useDeleteEntity`, `useFetchEntity`, `useFetchEntityByForeignId`, `useFetchEntityByShortId`, `useFetchManyEntities`, `useFetchManyEntitiesWrapper`, `useFetchDrafts`, `usePublishDraft`, `useIsEntitySaved`
→ details in [social-core.md](social-core.md)

## Entity lists / feeds (`./hooks/entity-lists`)
`useEntityList`, `useEntityListActions`
Types: `UseEntityListProps`, `UseEntityListValues`, `EntityListFilters`, `EntityListSort`, `EntityListConfig`, `EntityListFetchOptions`, `EntityListCreateEntityProps`, `EntityListDeleteEntityProps`
⚠️ Sorting: `EntityListSortByOptions` adds `decay`/`gravity`/`wilson`/`bayesian` (+ `rankParams`/`rankAnchor`/`rerank`). Validators: `validateSortBy`, `validateSortType`, `validateMetadataPropertyName`. → details in [feeds.md](feeds.md)

## Comments (`./hooks/comments`)
`useCommentSection`, `useCommentSectionData`, `useEntityComments`, `useReplies`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useFetchComment`, `useFetchCommentByForeignId`, `useFetchManyComments`, `useFetchManyCommentsWrapper`
Type: `MentionTriggers` (+ the `*CommentProps` family). → details in [social-core.md](social-core.md)

## Reactions (`./hooks/reactions`)
`useReactionToggle`, `useAddReaction`, `useRemoveReaction`, `useFetchEntityReactions`, `useFetchCommentReactions`, `useFetchEntityReactionsWrapper`, `useFetchCommentReactionsWrapper`
`ReactionType` = `upvote|downvote|like|love|wow|sad|angry|funny`. → details in [social-core.md](social-core.md)

## Collections (saved/bookmarked entities) (`./hooks/collections`)
`useCollections`, `useCollectionsActions`, `useCollectionEntitiesWrapper`
Types: `CreateCollectionProps`, `UpdateCollectionProps`, `DeleteCollectionProps`, `AddToCollectionProps`, `RemoveFromCollectionProps` (+ `Use*` types)

## Spaces (`./hooks/spaces`)
Read/scope: `useSpace`, `useSpaceData` (props: one of `space|spaceId|shortId|slug` + `include`)
Fetch: `useFetchSpace`, `useFetchSpaceByShortId`, `useFetchSpaceBySlug`, `useFetchManySpaces`, `useFetchSpaceBreadcrumb`, `useFetchSpaceChildren`, `useCheckSlugAvailability`
Lifecycle: `useCreateSpace`, `useUpdateSpace`, `useDeleteSpace`
Membership: `useJoinSpace`, `useLeaveSpace`, `useCheckMyMembership`, `useFetchSpaceMembers`, `useFetchSpaceTeam`, `useFetchUserSpaces`
Member mgmt: `useUpdateMemberRole`, `useApproveMember`, `useDeclineMember`, `useRemoveMember`, `useUnbanMember`
Moderation: `useModerateSpaceEntity`, `useModerateSpaceComment`, `useSpacePermissions`, `useSpaceMentions`
Rules: `useCreateRule`, `useUpdateRule`, `useDeleteRule`, `useFetchRule`, `useFetchManyRules`, `useReorderRules`
Digests: `useFetchDigestConfig`, `useUpdateDigestConfig`
→ details in [advanced.md](advanced.md)

## Space lists (discovery) (`./hooks/space-lists`)
`useSpaceList`, `useSpaceListActions` (+ `SpaceListCreateSpaceProps`, `SpaceListDeleteSpaceProps`, `FetchSpacesOptions`, `CreateSpaceOptions`, `DeleteSpaceOptions`)

## Follows (one-directional) (`./hooks/relationships/follows`)
`useFollowUser`, `useUnfollowByFollowId`, `useUnfollowUserByUserId`, `useFollowManager`, `useFetchFollowStatus`, `useFetchFollowers(ByUserId)`, `useFetchFollowing(ByUserId)`, `useFetchFollowersCount(ByUserId)`, `useFetchFollowingCount(ByUserId)`
→ vs Connections distinction in [advanced.md](advanced.md)

## Connections (mutual / friend requests) (`./hooks/relationships/connections`)
`useRequestConnection`, `useAcceptConnection`, `useDeclineConnection`, `useRemoveConnection`, `useRemoveConnectionByUserId`, `useConnectionManager`, `useFetchConnections(ByUserId)`, `useFetchConnectionStatus`, `useFetchConnectionsCount(ByUserId)`, `useFetchSentPendingConnections`, `useFetchReceivedPendingConnections`

## Chat (`./hooks/chat`)
Conversations: `useConversations`, `useConversation`, `useConversationData`, `useFetchConversation`, `useCreateDirectConversation`, `useFetchSpaceConversation`, `useUpdateConversation`, `useDeleteConversation`, `useConversationMembers`
Messages: `useChatMessages`, `useSendMessage`, `useEditMessage`, `useDeleteMessage`, `useToggleReaction`, `useMessageThread`, `useReportMessage`
Real-time: `useChatSocket`, `useTypingIndicator`
Unread: `useTotalUnreadCount`, `useUnreadConversationCount`, `useMarkConversationAsRead`
(Plus a large `chatSlice` of `set*`/`select*`/`upsert*` actions for integration-mode authors.) → topology + socket footgun in [advanced.md](advanced.md)

## App notifications (`./hooks/app-notifications`)
`useAppNotifications`, `useAppNotificationsActions` (+ `UseAppNotificationsProps`, `UseAppNotificationsValues`)

## Reports / moderation (`./hooks/reports`)
`useCreateReport`, `useFetchModeratedReports`, `useHandleSpaceEntityReport`, `useHandleSpaceCommentReport` (+ `Report`, `CreateReportProps`, etc.). Const `reportReasons` (+ `ReportReasonKey`).

## Search & AI (`./hooks/search`)
`useSearchContent`, `useSearchUsers`, `useSearchSpaces`, `useAskContent` (+ matching `*Props`/`*Return`/`*Result` types)

## Storage (`./hooks/storage`)
`useUploadFile`, `useUploadImage` (+ `RNFile`, `UploadFileOptions`, `UploadResponse`)

## Utilities
`useGetMetadata` (+ `GetMetadataProps`, `UrlMetadata*` types); helpers `handleError`, `keywordHelpers`, `safeMergeStyleProps`, `getUserName`, `getPublicFileUrl`; env `isDevelopment`/`isProduction`/`getEnvVar`; ⚠️ runtime config `getApiBaseUrl`/`getSocketUrl` (set via `<ReplykeProvider baseUrl>`).

---

## Data-model types (`./interfaces/models/*`)
`User`, `UserFull`, `AuthUser`, `UserRole` · `Entity` · `Comment`, `GifData` · `Reaction`, `ReactionType`, `ReactionCounts` · `Collection` · `Mention`, `UserMention`, `SpaceMention` · `Space`, `SpaceDetailed`, `SpacePreview`, `SpaceMemberPermissions`, `DigestConfig` · `SpaceMember`, `SpaceMemberRole`, `SpaceMemberStatus` · `Rule` · `Connection`, `EstablishedConnection`, `PendingConnection`, `ConnectionStatus` · `Conversation`, `ConversationPreview`, `ConversationMember`, `ChatMessage` · `Image`, `ImageVariant`, `File` · `AppNotification` (namespace) · `PaginatedResponse`, `PaginationMetadata` · `TimeFrame` · `EntityCommentsTree` · sort/filter types `EntityListSortByOptions`, `CommentsSortByOptions`, `SpaceListSortByOptions`, `SpaceListFilters`, `SortDirection`, `SortType`, `SortByReaction`. Most carry `*Include`/`*IncludeParam` variants controlling which relations the API hydrates.

For the field-level shape of any of these, `cat node_modules/@agora-sdk/core/dist/esm/interfaces/models/<Name>.d.ts`.

---

## Regenerating this file

It's a hand-curated digest of the export barrel. After an API change, diff it against `packages/core/src/index.ts` (the authoritative barrel) and update accordingly. Keep the ⚠️ divergence markers in sync with the table in [SKILL.md](../SKILL.md), [CHANGELOG.md](https://github.com/jenova-marie/agora-sdk/blob/main/CHANGELOG.md), and [SYNCING.md](https://github.com/jenova-marie/agora-sdk/blob/main/SYNCING.md).
