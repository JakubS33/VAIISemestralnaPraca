"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tx = {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: string;
  pricePerUnit: string | null;
  assetId: string;
  asset?: { symbol: string; name: string; type: "CRYPTO" | "STOCK" | "ETF" | "CASH" } | null;
};

export default function TransactionsClient({ walletId }: { walletId: string }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const norm = (s: string) => s.replace(/\s+/g, "").replace(",", ".");

  async function load() {
    setLoading(true);
    setError(null);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/transactions`, {
      cache: "no-store",
      credentials: "include",
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      setError("Nepodarilo sa načítať transakcie.");
      setLoading(false);
      return;
    }

    const j = (await r.json()) as Tx[];
    setTxs(j);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [walletId]);

  function startEdit(t: Tx) {
    setEditingId(t.id);
    setEditQty(String(t.quantity ?? ""));
    setEditPrice(String(t.pricePerUnit ?? ""));
  }

  async function saveEdit() {
    if (!editingId) return;

    const q = Number(norm(editQty));
    const p = Number(norm(editPrice));

    if (!Number.isFinite(q) || q <= 0) {
      setError("Quantity musí byť > 0");
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setError("Price per unit musí byť > 0");
      return;
    }

    setError(null);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/transactions?id=${encodeURIComponent(editingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity: q, pricePerUnit: p }),
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Update zlyhal");
      return;
    }

    setEditingId(null);
    await load();
  }

  async function deleteTx(id: string) {
    if (!confirm("Naozaj zmazať transakciu?")) return;

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/transactions?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Delete zlyhal");
      return;
    }

    setTxs((p) => p.filter((x) => x.id !== id));
  }

  const rows = useMemo(() => {
    return txs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [txs]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <Link href={`/wallets/${walletId}`} style={{ textDecoration: "underline" }}>
          ← Back to wallet
        </Link>
        <h1 style={{ margin: 0 }}>Transaction history</h1>
        <div />
      </div>

      {error && <p style={{ color: "tomato", marginTop: 10 }}>{error}</p>}

      {loading ? (
        <p style={{ marginTop: 18 }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ marginTop: 18 }}>No transactions yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {rows.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div key={t.id} style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {t.type} — {t.asset?.symbol ?? "???"} ({t.asset?.name ?? ""})
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 2 }}>
                      {new Date(t.date).toLocaleString("sk-SK")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => startEdit(t)}
                      disabled={isEditing}
                      style={{ border: "1px solid #333", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTx(t.id)}
                      style={{ border: "1px solid #333", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <input
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      placeholder="Quantity"
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #333", minWidth: 200 }}
                    />
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="Price per unit"
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #333", minWidth: 200 }}
                    />
                    <button
                      onClick={saveEdit}
                      style={{ border: "1px solid #333", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ border: "1px solid #333", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ opacity: 0.9, marginTop: 10 }}>
                    quantity: <b>{t.quantity}</b> | pricePerUnit: <b>{t.pricePerUnit ?? "-"}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
