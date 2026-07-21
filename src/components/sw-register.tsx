"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW é progressivo: falha silenciosa não afeta o app
      });
    }
  }, []);
  return null;
}
