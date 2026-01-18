"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      // aj keby request zlyhal, skusime refreshnúť UI a presmerovať
      router.replace("/auth/login");
      router.refresh();
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="nav-link nav-link--cta"
      onClick={onLogout}
      disabled={loading}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
