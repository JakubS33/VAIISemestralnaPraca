"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Wallet = {
  id: string;
  name: string;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function WalletDetailClient({ walletId }: { walletId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canSave = useMemo(() => name.trim().length >= 3 && currency.trim().length > 0, [name, currency]);

  async function load() {
    setLoading(true);
    setError(null);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}`, {
      cache: "no-store",
      credentials: "include",
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Wallet sa nepodarilo načítať");
      setLoading(false);
      return;
    }

    const data = (await r.json()) as Wallet;
    setWallet(data);
    setName(data.name ?? "");
    setCurrency(data.currency ?? "EUR");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim(), currency: currency.trim() }),
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Uloženie zlyhalo");
      setSaving(false);
      return;
    }

    const updated = (await r.json()) as Wallet;
    setWallet(updated);
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Naozaj zmazať túto peňaženku?")) return;

    setDeleting(true);
    setError(null);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Zmazanie zlyhalo");
      setDeleting(false);
      return;
    }

    router.replace("/wallets");
    router.refresh();
  }

  if (loading) return <div>Načítavam...</div>;

  if (!wallet) {
    return (
      <div style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <div style={{ color: "tomato" }}>{error ?? "Wallet neexistuje."}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ opacity: 0.8 }}>
          ID: <span style={{ opacity: 0.9, fontFamily: "monospace" }}>{wallet.id}</span>
        </div>

        {error && <div style={{ color: "tomato" }}>{error}</div>}

        <form onSubmit={save} style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Názov</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Názov (min. 3 znaky)"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #333" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Mena</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #333" }}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CZK">CZK</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="submit"
              disabled={!canSave || saving}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                cursor: !canSave || saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Ukladám..." : "Uložiť"}
            </button>

            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                cursor: deleting ? "not-allowed" : "pointer",
                marginLeft: "auto",
              }}
            >
              {deleting ? "Mazanie..." : "Zmazať"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
