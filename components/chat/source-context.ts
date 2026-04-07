import { createContext } from "react";
import type { Citation } from "@/types";

// Context value: a callback to open the source drawer for a citation.
// Default is a no-op so components that render outside the provider don't crash.
export const SourceContext = createContext<(citation: Citation) => void>(() => {});
