"use client";

import { useEffect } from "react";

export default function BlockBack() {
  useEffect(() => {
    history.pushState(null, "", location.href);
    const onPopState = () => {
      history.pushState(null, "", location.href);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
