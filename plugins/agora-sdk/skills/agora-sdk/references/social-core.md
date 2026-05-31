# Social Core: Entity → Comments → Reactions

This is the 80% path — attaching comments and votes/reactions to a piece of your app's content. Almost everything here is upstream-compatible; the only Agora-specific concern is the import scope. For exact hook return shapes and arguments, use the **lookup ladder** in [SKILL.md](../SKILL.md): `api-surface.md` → the installed `.d.ts` → (optionally) the Replyke MCP / `docs.replyke.com`. The `→` pointers below name the relevant MCP/docs path *and* the offline `.d.ts` location.

## The entity is the anchor

An **entity** represents one piece of content (a post, article, product, video…). You typically map it to your own record via `foreignId`. Wrap the region in `EntityProvider`; scoped hooks then operate on that entity.

```tsx
import { EntityProvider, useEntity } from "@agora-sdk/react-js";

<EntityProvider foreignId="post_123" createIfNotFound>
  <PostView />
</EntityProvider>
```

`EntityProvider` takes **one of** `foreignId` | `entityId` | `shortId` | `entity`, plus optional `createIfNotFound` (lazily creates the entity the first time someone interacts — ideal when your posts live in your own DB and Agora only tracks their social layer).

```tsx
function PostView() {
  const { entity, loading } = useEntity();   // scoped to the provider above
  // entity.upvotes, entity.downvotes, entity.repliesCount, entity.metadata, …
}
```

Standalone entity hooks (work under the root provider, no scope needed): `useFetchEntity`, `useFetchEntityByForeignId`, `useFetchEntityByShortId`, `useCreateEntity`, `useUpdateEntity`, `useDeleteEntity`, `useFetchManyEntities`, `useIsEntitySaved`, drafts (`useFetchDrafts`, `usePublishDraft`). → MCP/docs `/v7/hooks/entities`, or offline `ls node_modules/@agora-sdk/core/dist/esm/hooks/entities/`.

## Comments

Inside an `EntityProvider`, the comment section is its own scope. `CommentSectionProvider` wraps comment hooks (often nested implicitly); read threads and mutate them:

```tsx
import { useEntityComments, useCreateComment, useReplies } from "@agora-sdk/react-js";

const { comments, loading, hasMore, loadMore } = useEntityComments();   // top-level thread
const { createComment } = useCreateComment();
await createComment({ content: "first!" });          // optionally: parentId, gif, mentions
```

Comment hooks: `useCommentSection` / `useCommentSectionData` (scope), `useEntityComments`, `useReplies`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useFetchComment`, `useFetchCommentByForeignId`, `useFetchManyComments(+Wrapper)`. Mentions use `MentionTriggers` (customize the `@`/`#` triggers). → MCP/docs `/v7/hooks/comments/use-create-comment`, or offline the `.d.ts` under `node_modules/@agora-sdk/core/dist/esm/hooks/comments/`.

## Reactions (votes & emoji)

`ReactionType` covers: `upvote`, `downvote`, `like`, `love`, `wow`, `sad`, `angry`, `funny`. Toggle is the common case (adds, or removes if already present):

```tsx
import { useReactionToggle, useFetchEntityReactions } from "@agora-sdk/react-js";

const { toggleReaction } = useReactionToggle();
await toggleReaction({ type: "upvote" });            // on the scoped entity

const { reactions } = useFetchEntityReactions();     // counts + the current user's reaction
```

Hooks: `useAddReaction`, `useRemoveReaction`, `useReactionToggle`; reads via `useFetchEntityReactions` / `useFetchCommentReactions` (+`Wrapper` paginated variants). Comment reactions take the comment id. → MCP/docs `/v7/hooks/reactions`, or offline `ls node_modules/@agora-sdk/core/dist/esm/hooks/reactions/`.

## Putting it together

```tsx
<ReplykeProvider projectId="proj_…" baseUrl="https://api.myhost.com/v7">
  <EntityProvider foreignId="post_123" createIfNotFound>
    <PostBody />
    <VoteBar />        {/* useReactionToggle + useFetchEntityReactions */}
    <CommentThread />  {/* useEntityComments + useCreateComment + useReplies */}
  </EntityProvider>
</ReplykeProvider>
```

## Where to go next (use the lookup ladder)

- **Data-model field shapes:** offline `cat node_modules/@agora-sdk/core/dist/esm/interfaces/models/{Entity,Comment,Reaction}.d.ts`; prose at MCP/docs `/v7/data-models/{entity,comment,reaction}`.
- **Prebuilt UI components** (avatars, comment section, etc.) instead of hand-rolling: MCP/docs `/v7/components`. These ship as separate `@agora-sdk/comments-social-*` / `@agora-sdk/ui-core-*` packages mirroring upstream's `@replyke/*` UI packages — apply the scope translation.
- **Reporting/moderation:** `useCreateReport`, plus space-moderator hooks (`useFetchModeratedReports`, `useHandleSpaceEntityReport`). → see [api-surface.md](api-surface.md) › Reports.
- **Saving/bookmarking** into user collections: `useCollections()` / `useCollectionsActions()`.

Remember the divergence table in [SKILL.md](../SKILL.md): import from `@agora-sdk/*`, never `@replyke/*`.
