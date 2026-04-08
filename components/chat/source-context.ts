import { createContext } from "react";
import type { Citation } from "@/types";

export interface SourceContextValue {
  /** Open the PDF for this citation in a new tab. */
  openPdf: (citation: Citation) => void;
  /** Open the debug drawer for the given message id. */
  openDebug: (messageId: string) => void;
  /** URL map: document_id → signed PDF URL */
  urlMap: Map<string, string>;
}

export const SourceContext = createContext<SourceContextValue>({
  openPdf: () => {},
  openDebug: () => {},
  urlMap: new Map(),
});
