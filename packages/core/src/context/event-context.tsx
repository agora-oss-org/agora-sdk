import React, { createContext } from "react";
import useEventData, {
  UseEventDataProps,
  UseEventDataValues,
} from "../hooks/events/useEventData";

export type EventContextProps = UseEventDataProps & {
  children: React.ReactNode;
};
export interface EventContextValues extends UseEventDataValues {}

export const EventContext = createContext<Partial<EventContextValues>>({});

export const EventProvider: React.FC<EventContextProps> = ({
  children,
  ...restOfProps
}: EventContextProps) => {
  const data = useEventData(restOfProps as UseEventDataProps);

  if (
    !("eventId" in restOfProps && restOfProps.eventId) &&
    !("event" in restOfProps && restOfProps.event?.id)
  ) {
    return null;
  }

  return (
    <EventContext.Provider value={data}>{children}</EventContext.Provider>
  );
};
