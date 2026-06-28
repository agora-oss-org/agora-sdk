import { useContext } from "react";
import {
  EventContext,
  EventContextValues,
} from "../../context/event-context";

export default function useEvent(): Partial<EventContextValues> {
  return useContext(EventContext);
}
