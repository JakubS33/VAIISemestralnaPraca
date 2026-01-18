"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Wallet = { id: string; name: string; currency: string };
type WalletAsset = {
  id: string;
  kind: "MAIN" | "OTHER";
  name: string;
  amount: string | null; // Decimal
  value: string; // Decimal
};

export default function WalletOverviewClient({ walletId }: { walletId: string }) {
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [mainAssets, setMainAssets] = useState<WalletAsset[]>([]);
  const [otherAssets, setOtherAssets] = useState<WalletAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modal state (tvoja existujúca logika)
  const [showAdd, setShowAdd] = useState<null | "MAIN" | "OTHER">(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(""); // len MAIN
  const [value, setValue] = useState(""); // MAIN aj OTHER
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!showAdd) return false;
    if (name.trim().length < 2) return false;
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    if (showAdd === "MAIN") {
      const a = Number(amount);
      if (!Number.isFinite(a)) return false;
    }
    return true;
  }, [showAdd, name, amount, value]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const w = await fetch(`/api/wallets/${encodeURIComponent(walletId)}`, {
      cache: "no-store",
      credentials: "include",
    });

    if (w.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!w.ok) {
      setError("Wallet sa nepodarilo načítať.");
      setLoading(false);
      return;
    }

    const walletData = (await w.json()) as Wallet;
    setWallet(walletData);

    const [m, o] = await Promise.all([
      fetch(`/api/wallets/${encodeURIComponent(walletId)}/assets?kind=MAIN`, {
        cache: "no-store",
        credentials: "include",
      }),
      fetch(`/api/wallets/${encodeURIComponent(walletId)}/assets?kind=OTHER`, {
        cache: "no-store",
        credentials: "include",
      }),
    ]);

    if (m.status === 401 || o.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    setMainAssets(m.ok ? ((await m.json()) as WalletAsset[]) : []);
    setOtherAssets(o.ok ? ((await o.json()) as WalletAsset[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId]);

  function openAdd(kind: "MAIN" | "OTHER") {
    setShowAdd(kind);
    setName("");
    setAmount("");
    setValue("");
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!showAdd) return;

    setSaving(true);
    setError(null);

    const payload: any = {
      kind: showAdd,
      name: name.trim(),
      value: Number(value) * Number(amount),
    };
    if (showAdd === "MAIN") payload.amount = Number(amount);

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? "Nepodarilo sa pridať.");
      setSaving(false);
      return;
    }

    setShowAdd(null);
    setSaving(false);
    await loadAll();
    router.refresh();
  }

  async function removeItem(kind: "MAIN" | "OTHER", id: string) {
    if (!confirm("Naozaj odstrániť položku?")) return;

    const r = await fetch(
      `/api/wallets/${encodeURIComponent(walletId)}/assets?id=${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      setError("Odstránenie zlyhalo.");
      return;
    }

    if (kind === "MAIN") setMainAssets((p) => p.filter((x) => x.id !== id));
    else setOtherAssets((p) => p.filter((x) => x.id !== id));
  }

  if (loading) return <div style={{ padding: 24 }}>Načítavam...</div>;
  if (!wallet) return <div style={{ padding: 24, color: "tomato" }}>{error ?? "Wallet nenájdená."}</div>;

  const displayWallet = wallet;

  const fmt2 = (s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    return n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
  };

  const fmtSigned2 = (s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    return n.toLocaleString("sk-SK", { maximumFractionDigits: 2, signDisplay: "always" });
  };

  return (
    <section className="wallet-detail">
      <header className="wallet-detail-header">
        <Link href="/wallets" className="btn-secondary">
          ← Back to wallets
        </Link>

        <div className="wallet-detail-title">
          <h1>Wallet: {displayWallet.name}</h1>
          <p>Currency: {displayWallet.currency}</p>
        </div>

        <Link href={`/wallets/${displayWallet.id}/transactions`} className="btn-ghost">
          Check transaction history
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="wallet-detail-grid">
        {/* CHART */}
        <div className="wallet-detail-chart">
          <div className="asset-card">
            <h2>Value over time</h2>
            <p>(Chart placeholder – not implemented yet)</p>
          </div>
        </div>

        {/* MAIN ASSETS */}
        <div className="asset-card">
          <div className="asset-card-header">
            <h2>Main assets</h2>
            <button type="button" className="btn-primary btn-small" onClick={() => openAdd("MAIN")}>
              Add asset
            </button>
          </div>

          <div className="asset-list">
            {mainAssets.length === 0 ? (
              <p>No main assets yet.</p>
            ) : (
              mainAssets.map((asset) => (
                <div key={asset.id} className="asset-row">
                  <div className="asset-row-main">
                    <div className="wallet-name">{asset.name}</div>
                    <div className="wallet-meta">
                      amount: {asset.amount ?? "-"} | value: {fmt2(asset.value)} {displayWallet.currency}
                    </div>
                  </div>
                  <div className="wallet-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => removeItem("MAIN", asset.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* OTHER ASSETS */}
        <div className="asset-card">
          <div className="asset-card-header">
            <h2>Other assets</h2>
            <button type="button" className="btn-primary btn-small" onClick={() => openAdd("OTHER")}>
              Add asset
            </button>
          </div>

          <div className="asset-list">
            {otherAssets.length === 0 ? (
              <p>No other assets yet.</p>
            ) : (
              otherAssets.map((asset) => (
                <div key={asset.id} className="asset-row">
                  <div className="asset-row-main">
                    <div className="wallet-name">{asset.name}</div>
                    <div className="wallet-meta">
                      value: {fmtSigned2(asset.value)} {displayWallet.currency}
                    </div>
                  </div>
                  <div className="wallet-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => removeItem("OTHER", asset.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ADD MODAL – tvoja pôvodná logika, len mierne upratané */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 12,
              background: "#d0bdbd",
              padding: 16,
            }}
          >
            <h2 style={{ marginBottom: 10, color: "#4f1650", fontSize: 20, fontWeight: "600" }}>
              Add {showAdd === "MAIN" ? "main asset" : "other asset"}
            </h2>

            <form onSubmit={createItem} className="asset-form" style={{ marginTop: 12 , color: 'black'}}>
              <label className="form-field">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={showAdd === "MAIN" ? "e.g. BTC, SPY, Cash..." : "e.g. savings, debt..."}
                />
              </label>

              {showAdd === "MAIN" && (
                <label className="form-field">
                  <span>Amount</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 0.5" />
                </label>
              )}

              <label className="form-field">
                <span>Purchase price ({displayWallet.currency})</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={showAdd === "OTHER" ? "e.g. 500 or -50" : "e.g. 1200"}
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn-primary btn-small" onClick={() => setShowAdd(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-small" disabled={!canSave || saving}>
                  {saving ? "Saving..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
