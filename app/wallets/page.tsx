"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Wallet = {
  id: string;
  name: string;
  currency: string;
  createdAt?: string;
};

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // --- EDIT STATE ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/wallets", {
        cache: "no-store",
        credentials: "include",
      });
      if (r.status === 401) {
        window.location.href = "/auth/login";
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to load wallets");
      }
      const data = (await r.json()) as Wallet[];
      setWallets(data);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWallet(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const r = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, currency }),
      });

      if (r.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to create wallet");
      }

      setName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteWallet(id: string) {
    if (!confirm("Do you really want to delete your wallet?")) return;
    setError(null);
    try {
      const r = await fetch(`/api/wallets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (r.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed to delete wallet");
      }

      // ak mažeš wallet, ktorá je práve v edit mode, resetni edit
      setWallets((prev) => prev.filter((w) => w.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditName("");
        setEditCurrency("EUR");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error");
    }
  }

  function startEdit(w: Wallet) {
    setError(null);
    setEditingId(w.id);
    setEditName(w.name);
    setEditCurrency(w.currency);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCurrency("EUR");
  }

  async function saveEdit(id: string) {
  if (editName.trim().length < 3) {
    setError("The name must have at least 3 characters.");
    return;
  }

  setError(null);
  setSavingEdit(true);

  try {
    const r = await fetch(`/api/wallets?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        currency: editCurrency,
      }),
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error ?? "Failed to update wallet");
    }

    const updated = (await r.json()) as Wallet;

    setWallets((prev) => prev.map((w) => (w.id === id ? updated : w)));
    cancelEdit();
  } catch (e: any) {
    setError(e?.message ?? "Error");
  } finally {
    setSavingEdit(false);
  }
}


  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Wallets</h1>

        <Link href="/dashboard" style={{ textDecoration: "underline" }}>
          Back to dashboard
        </Link>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Add wallet</h2>

        <form onSubmit={createWallet} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (at least 3 characters)"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", minWidth: 240 }}
          />

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", color: "#9b1818" }}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>

          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #333",
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Vytváram..." : "Vytvoriť"}
          </button>
        </form>

        {error && <div style={{ marginTop: 10, color: "tomato" }}>{error}</div>}
      </div>

      <div style={{ marginTop: 30, borderBottom: "10px solid #6e1029", paddingBottom: 6 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>List of your wallets</h2>
      </div>

      <div style={{ marginTop: 18 }}>
        {loading ? (
          <div>Loading...</div>
        ) : wallets.length === 0 ? (
          <div>You have no wallets.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {wallets.map((w) => {
              const isEditing = editingId === w.id;

              return (
                <div
                  key={w.id}
                  style={{
                    padding: 14,
                    border: "1px solid #333",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {!isEditing ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{w.name}</div>
                        <div style={{ opacity: 0.8, marginTop: 2 }}>Currency: {w.currency}</div>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", minWidth: 240 }}
                        />
                        <select
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value)}
                          style={{ padding: 10, borderRadius: 8, border: "1px solid #333", color: "#9b1818" }}
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    {!isEditing ? (
                      <>
                        <Link
                          href={`/wallets/${w.id}`}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #333",
                            textDecoration: "none",
                            color: "#d7143e",
                          }}
                        >
                          Open
                        </Link>

                        <button
                          onClick={() => startEdit(w)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #333",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteWallet(w.id)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #333",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveEdit(w.id)}
                          disabled={savingEdit}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #333",
                            cursor: savingEdit ? "not-allowed" : "pointer",
                          }}
                        >
                          {savingEdit ? "Ukladám..." : "Save"}
                        </button>

                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #333",
                            cursor: savingEdit ? "not-allowed" : "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
