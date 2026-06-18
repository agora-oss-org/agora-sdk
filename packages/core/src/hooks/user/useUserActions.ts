import { useCallback } from "react";
import { useReplykeDispatch } from "../../store/hooks";
import type { AuthUser } from "../../interfaces/models/User";
import {
  setUser,
  clearUser,
  setUpdating,
  setError,
  clearError,
  updateUserOptimistic,
} from "../../store/slices/userSlice";
import {
  useUpdateUserMutation,
  type UpdateUserParams,
} from "../../store/api/userApi";

/**
 * Redux-powered hook that provides current user management actions
 * Focused on current user operations only
 */
export function useUserActions() {
  const dispatch = useReplykeDispatch();
  
  // RTK Query mutations for current user
  const [updateUserMutation] = useUpdateUserMutation();

  // User data management actions
  const handleSetUser = useCallback((user: AuthUser | null) => {
    // IMPORTANT: Validate that user has required data before setting
    // This prevents empty or partial user objects from being set to state
    if (user && !user.id) {
      console.warn('Attempted to set user without id - ignoring invalid user data');
      return;
    }
    dispatch(setUser(user));
    dispatch(clearError());
  }, [dispatch]);

  const handleClearUser = useCallback(() => {
    dispatch(clearUser());
    dispatch(clearError());
  }, [dispatch]);

  // Update user with optimistic updates for instant UI feedback
  const updateUser = useCallback(
    async ({ projectId, userId, update, currentUser }: { projectId: string; userId: string; update: UpdateUserParams; currentUser?: any }) => {
      if (!projectId || !userId) {
        throw new Error("Project ID and User ID are required");
      }

      dispatch(setUpdating(true));
      dispatch(clearError());

      // Store original user state for potential reversion
      const originalUser = currentUser;

      // Build optimistic update excluding fields that require server transformation:
      // - File uploads (avatar/banner as File) - we don't know the final URL
      // - Location - server transforms { latitude, longitude } to GeoJSON format
      const optimisticUpdate: Partial<AuthUser> = {};
      if (update.name !== undefined) optimisticUpdate.name = update.name;
      if (update.username !== undefined) optimisticUpdate.username = update.username;
      if (update.bio !== undefined) optimisticUpdate.bio = update.bio;
      if (update.birthdate !== undefined)
        optimisticUpdate.birthdate = update.birthdate
          ? update.birthdate.toISOString()
          : update.birthdate;
      if (update.metadata !== undefined) optimisticUpdate.metadata = update.metadata;
      // Only apply avatar optimistically if it's a string URL (not a file upload)
      if (typeof update.avatar === 'string' || update.avatar === null) {
        optimisticUpdate.avatar = update.avatar;
      }

      // OPTIMISTIC UPDATE: Apply changes immediately for instant UI feedback
      if (Object.keys(optimisticUpdate).length > 0) {
        dispatch(updateUserOptimistic(optimisticUpdate));
      }

      try {
        const result = await updateUserMutation({ 
          projectId, 
          userId, 
          update 
        }).unwrap();
        
        // Replace optimistic update with real server data
        dispatch(setUser(result));
        return result;
      } catch (error) {
        // REVERT OPTIMISTIC UPDATE: Restore original user state on API failure
        if (originalUser) {
          dispatch(setUser(originalUser));
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
        dispatch(setError(errorMessage));
        throw error;
      } finally {
        dispatch(setUpdating(false));
      }
    },
    [updateUserMutation, dispatch]
  );

  // Removed other-user methods - use existing legacy hooks instead:
  // - useFetchUser
  // - useFetchUserByForeignId
  // - useCheckUsernameAvailability  
  // - useFetchUserSuggestions

  // Error handling actions
  const clearUserError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    // Current user data management
    setUser: handleSetUser,
    clearUser: handleClearUser,
    
    // Current user operations
    updateUser,
    
    // Error handling
    clearError: clearUserError,
  };
}

export default useUserActions;