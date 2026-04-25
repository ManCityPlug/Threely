"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signup");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  );
}
