// app/wallets/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Wallet {
  id: string;
  name: string;
  currency: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallets")
      .then((r) => r.json())
      .then((data: Wallet[]) => {
        setWallets(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load wallets.");
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim().length < 3) {
      setError("Wallet name must have at least 3 characters.");
      return;
    }

    if (!currency) {
      setError("Currency is required.");
      return;
    }

    setError(null);

    const payload = { name: name.trim(), currency };

    if (editingId) {
      const res = await fetch(`/api/wallets?id=${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update wallet.");
        return;
      }

      setWallets((prev) =>
        prev.map((w) => (w.id === editingId ? data : w))
      );
      setEditingId(null);
      setName("");
      setCurrency("EUR");
    } else {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create wallet.");
        return;
      }

      setWallets((prev) => [...prev, data]);
      setName("");
      setCurrency("EUR");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/wallets?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to delete wallet.");
      return;
    }

    setWallets((prev) => prev.filter((w) => w.id !== id));
  }

  function startEdit(wallet: Wallet) {
    setEditingId(wallet.id);
    setName(wallet.name);
    setCurrency(wallet.currency);
    setError(null);
  }

  return (
    <section>
      <h1>My wallets</h1>

      <form onSubmit={handleSubmit} className="form-card">
        <h2 style = {{marginBottom: "1.5rem", fontSize: "1.5rem"}}>
          {editingId ? "Edit wallet" : "Create new wallet"}
        </h2>

        {error && <p className="form-error">{error}</p>}

        <label className="form-field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crypto DCA"
            required
          />
        </label>

        <label className="form-field">
          <span>Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            required
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="CZK">CZK</option>
          </select>
        </label>

        <button type="submit" className="btn-primary">
          {editingId ? "Save changes" : "Create wallet"}
        </button>
      </form>

      {loading ? (
        <p>Loading wallets...</p>
      ) : wallets.length === 0 ? (
        <p>No wallets yet. Create the first one above.</p>
      ) : (
        <ul className="wallet-list">
          {wallets.map((w) => (
            <li key={w.id} className="wallet-item">
              
              <Link href={`/wallets/${w.id}`} className="wallet-link-area">
                <div>
                  <div className="wallet-name">{w.name}</div>
                  <div className="wallet-meta">Currency: {w.currency}</div>
                </div>
              </Link>

              <div className="wallet-actions">
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => startEdit(w)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-small"
                  onClick={() => handleDelete(w.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
