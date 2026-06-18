import useLiveChatMessages, {
  UseLiveChatMessagesProps,
  UseLiveChatMessagesValues,
} from "./useLiveChatMessages";

/** @deprecated Renamed to `UseLiveChatMessagesProps`. */
export type UseChatMessagesProps = UseLiveChatMessagesProps;
/** @deprecated Renamed to `UseLiveChatMessagesValues`. */
export type UseChatMessagesValues = UseLiveChatMessagesValues;

/**
 * @deprecated Use `useLiveChatMessages` instead. This alias forwards to it and
 * will be removed in a future major version.
 */
function useChatMessages(
  props: UseChatMessagesProps
): UseChatMessagesValues {
  return useLiveChatMessages(props);
}

export default useChatMessages;
