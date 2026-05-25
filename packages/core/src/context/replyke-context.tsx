import React, { createContext } from "react";
import useProjectData, {
  UseProjectDataProps,
  UseProjectDataValues,
} from "../hooks/projects/useProjectData";
import { ReplykeStoreProvider } from "./replyke-store-context";
import { setApiBaseUrl } from "../config/runtime";

export interface ReplykeContextProps extends UseProjectDataProps {
  signedToken?: string | null | undefined;
  /** Agora server base URL incl. /v7 (e.g. https://host/v7). The app parses its own platform env
   *  and passes it here; defaults to http://localhost:4000/v7 when omitted. */
  baseUrl?: string;
  children: React.ReactNode;
}

export interface ReplykeContextValues extends UseProjectDataValues {}

export const ReplykeContext = createContext<ReplykeContextValues>({
  projectId: "",
  project: null,
});

export const ReplykeProvider: React.FC<ReplykeContextProps> = ({
  projectId,
  signedToken,
  baseUrl,
  children,
}: ReplykeContextProps) => {
  // Set the runtime base URL during render so it's in place before useProjectData's effect (and
  // every other hook) fires its first request. Idempotent module-singleton set.
  setApiBaseUrl(baseUrl);

  const data = useProjectData({ projectId });

  if (!projectId)
    throw new Error("projectId in ReplykeProvider is " + typeof projectId);

  return (
    <ReplykeContext.Provider value={data}>
      <ReplykeStoreProvider projectId={projectId} signedToken={signedToken}>
        {children}
      </ReplykeStoreProvider>
    </ReplykeContext.Provider>
  );
};
