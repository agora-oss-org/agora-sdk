import { baseApi } from "./baseApi";
import type { PushEventType } from "../../interfaces/PushEventType";
import type { MuteDuration } from "../../interfaces/MuteDuration";
import type { ConversationMember } from "../../interfaces/models/ConversationMember";

// ──────────────────────────────────────────────────────────────────────────────
// Param / response types — mirror the server exactly (no aliases/renames).
// ──────────────────────────────────────────────────────────────────────────────

interface GetNotificationPreferencesParams {
  projectId: string;
}

interface UpdateNotificationPreferencesParams {
  projectId: string;
  // The set of push event types the user has opted OUT of. Server-exact names.
  disabledTypes: PushEventType[];
}

// GET/PUT /:projectId/push-notifications/preferences both return this shape.
export interface NotificationPreferencesResponse {
  disabledTypes: PushEventType[];
}

interface MuteConversationParams {
  projectId: string;
  conversationId: string;
  // The duration CHOICE (never a raw timestamp) — `null` clears the mute.
  // The server resolves the choice to a concrete `mutedUntil` server-side and
  // represents "forever" via the explicit `mutedForever` signal on the member.
  duration: MuteDuration | null;
}

// POST /:projectId/chat/conversations/:conversationId/mute returns the acting
// user's own (self-serialized) member row.
export interface MuteConversationResponse {
  currentMember: ConversationMember;
}

/**
 * RTK Query endpoints for end-user push notification preferences and
 * conversation mute. These mirror the server routes exactly:
 *   - GET  /:projectId/push-notifications/preferences
 *   - PUT  /:projectId/push-notifications/preferences
 *   - POST /:projectId/chat/conversations/:conversationId/mute
 */
export const notificationPreferencesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Read the acting user's disabled push types (all-on / empty when unset).
    getNotificationPreferences: builder.query<
      NotificationPreferencesResponse,
      GetNotificationPreferencesParams
    >({
      query: ({ projectId }) => ({
        url: `/${projectId}/push-notifications/preferences`,
        method: "GET",
      }),
      providesTags: (result, error, { projectId }) => [
        { type: "NotificationPreferences" as const, id: projectId },
      ],
    }),

    // Upsert the acting user's disabled push types.
    updateNotificationPreferences: builder.mutation<
      NotificationPreferencesResponse,
      UpdateNotificationPreferencesParams
    >({
      query: ({ projectId, disabledTypes }) => ({
        url: `/${projectId}/push-notifications/preferences`,
        method: "PUT",
        body: { disabledTypes },
      }),
      // Optimistically reflect the new set in the cached read.
      async onQueryStarted(
        { projectId, disabledTypes },
        { dispatch, queryFulfilled }
      ) {
        const patch = dispatch(
          notificationPreferencesApi.util.updateQueryData(
            "getNotificationPreferences",
            { projectId },
            (draft) => {
              draft.disabledTypes = disabledTypes;
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: "NotificationPreferences" as const, id: projectId },
      ],
    }),

    // Set / clear the acting user's conversation mute. The duration is sent as
    // the CHOICE; `null` clears it.
    muteConversation: builder.mutation<
      MuteConversationResponse,
      MuteConversationParams
    >({
      query: ({ projectId, conversationId, duration }) => ({
        url: `/${projectId}/chat/conversations/${conversationId}/mute`,
        method: "POST",
        body: { duration },
      }),
    }),
  }),
});

// Hooks for use in components.
export const {
  useGetNotificationPreferencesQuery,
  useLazyGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useMuteConversationMutation,
} = notificationPreferencesApi;

// Endpoints for manual cache management.
export const {
  getNotificationPreferences,
  updateNotificationPreferences,
  muteConversation,
} = notificationPreferencesApi.endpoints;
