"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Preserve any query params (e.g. ?error=auth)
    const params = window.location.search;
    router.replace(`/welcome${params}`);
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  );
}
