// app/auth/register/page.tsx
"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("@");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (pwd.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (pwd !== pwd2) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    alert("Demo registration – real auth will be implemented later.");
  }

  return (
    <section>
      <h1 style={{ padding: "1rem 0", fontSize: "2.25rem" }}>Create account</h1>
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

        <label className="form-field">
          <span>Repeat password</span>
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn-primary">
          Create account
        </button>
      </form>
    </section>
  );
}
