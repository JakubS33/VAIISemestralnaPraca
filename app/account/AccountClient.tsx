"use client";

import { useEffect, useMemo, useState } from "react";

type Me = { id: string; email: string };

export default function AccountClient() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setOk(null);

    const r = await fetch("/api/account", { cache: "no-store", credentials: "include" });
    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      setError("Failed to load account.");
      setLoading(false);
      return;
    }

    const j = (await r.json()) as { user: Me };
    setMe(j.user);
    setEmail(j.user.email);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const canSave = useMemo(() => {
    if (!me) return false;
    const emailChanged = email.trim().toLowerCase() !== me.email.toLowerCase();
    const wantsPasswordChange = newPassword.trim().length > 0;

    if (!emailChanged && !wantsPasswordChange) return false;
    if (email.trim().length < 5 || !email.includes("@")) return false;

    if (wantsPasswordChange) {
      if (newPassword.length < 6) return false;
      if (currentPassword.length < 1) return false;
    }

    return true;
  }, [me, email, currentPassword, newPassword]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    setOk(null);

    const payload: any = {
      email: email.trim().toLowerCase(),
    };
    if (newPassword.trim().length > 0) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    const r = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j?.error ?? "Update failed.");
      setSaving(false);
      return;
    }

    setOk("Saved.");
    setCurrentPassword("");
    setNewPassword("");
    setSaving(false);
    await load();
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!me) return <div style={{ padding: 24, color: "tomato" }}>{error ?? "No user."}</div>;

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1>Account settings</h1>
        <p>Update your account email and password.</p>
      </div>

      {error && <p className="form-error">{error}</p>}
      {ok && <p style={{ color: "#22c55e", marginBottom: 12 }}>{ok}</p>}

      <div className="dashboard-grid">
        <div className="dashboard-actions">
          <div className="form-card">
            <h2 style={{ marginTop: 0 }}>Profile</h2>
            <form onSubmit={save}>
              <label className="form-field">
                <span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <hr style={{ border: 0, borderTop: "1px solid #1f2937", margin: "12px 0" }} />

              <label className="form-field">
                <span>Current password (required only when changing password)</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </label>

              <button className="btn-primary" type="submit" disabled={!canSave || saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>

        <aside className="dashboard-summary">
          <div className="summary-card">
            <h2>Security</h2>
            <p className="hero-card-small" style={{ marginTop: 0 }}>
              If you change your password, you will stay logged in (session cookie remains valid). You can
              also log out and log in again.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
