// app/auth/login/page.tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // veľmi jednoduchá KLIENTSKA validácia
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (pwd.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    alert("Demo login – authentication not implemented yet.");
  }

  return (
    <section>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit} className="form-card">
        {error && <p className="form-error">{error}</p>}

        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span>Password</span>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn-primary">
          Sign in
        </button>
      </form>
    </section>
  );
}
