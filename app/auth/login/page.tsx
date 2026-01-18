"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Dôležité: nech sa HttpOnly session cookie korektne uloží/posiela (aj keď máš odlišný origin)
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(j?.error ?? "Login failed");
        return;
      }

      // ✅ cookie je HttpOnly → nevidíš ho v JS, ale browser ho uloží
      router.replace("/wallets");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Sign in</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333" }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333" }}
          />
        </div>

        {error && <div style={{ color: "tomato" }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
