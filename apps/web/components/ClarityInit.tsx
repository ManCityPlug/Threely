"use client";

import { useEffect } from "react";
import Clarity from "@microsoft/clarity";

export default function ClarityInit() {
  useEffect(() => {
    Clarity.init("vm4n4qax20");
  }, []);

  return null;
}
