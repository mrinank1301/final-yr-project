"use client";

import { useEffect } from "react";

/**
 * Catches "Attempting to use a disconnected port object" errors.
 * This error comes from Chrome extension APIs (e.g. DevTools, other extensions)
 * when a message port is used after the other side has disconnected.
 * It is not from this app's code. We suppress it so it doesn't appear as an uncaught error.
 */
export function DisconnectedPortErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = event.message ?? String(event.error);
      if (
        typeof msg === "string" &&
        msg.includes("Attempting to use a disconnected port object")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      return false;
    };

    window.addEventListener("error", handleError, true);
    return () => window.removeEventListener("error", handleError, true);
  }, []);

  return null;
}
