"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletValueChart } from "./WalletValueChart";

type Wallet = { id: string; name: string; currency: string };

type WalletAsset = {
  id: string;
  kind: "MAIN" | "OTHER";
  name: string;
  amount: string | null; // Decimal
  value: string; // Decimal
  assetId: string | null;
  asset?: {
    id: string;
    type: "CRYPTO" | "STOCK" | "ETF" | "CASH";
    symbol: string;
    name: string;
    provider: "COINGECKO" | "TWELVEDATA" | "MANUAL";
    apiId: string | null;
    exchange: string | null;
  } | null;
};

type CatalogAsset = {
  id: string;
  type: "CRYPTO" | "STOCK" | "ETF" | "CASH";
  symbol: string;
  name: string;
  provider: "COINGECKO" | "TWELVEDATA" | "MANUAL";
  apiId: string | null;
  exchange: string | null;
};

type WalletTx = {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: string; // Decimal
  pricePerUnit: string | null; // Decimal
  assetId: string;
  asset?: { symbol: string; name: string; type: "CRYPTO" | "STOCK" | "ETF" | "CASH" } | null;
};

export default function WalletOverviewClient({ walletId }: { walletId: string }) {
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);

  // MAIN assets už NEŤAHÁME z /assets?kind=MAIN – vyrátame ich z transactions.
  const [otherAssets, setOtherAssets] = useState<WalletAsset[]>([]);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({}); // Asset.id -> price

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modal state
  const [showAdd, setShowAdd] = useState<null | "MAIN" | "OTHER">(null);
  const [name, setName] = useState(""); // OTHER name
  const [amount, setAmount] = useState(""); // MAIN amount
  const [value, setValue] = useState(""); // OTHER value
  const [saving, setSaving] = useState(false);

  // MAIN asset picker
  const [assetQuery, setAssetQuery] = useState("");
  const [assetType, setAssetType] = useState<"CRYPTO" | "STOCK" | "ETF">("CRYPTO");
  const [suggestions, setSuggestions] = useState<CatalogAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<CatalogAsset | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");

  const canSave = useMemo(() => {
    if (!showAdd) return false;

    if (showAdd === "MAIN") {
      if (!selectedAsset) return false;
      const a = Number(amount);
      const p = Number(purchasePrice);
      if (!Number.isFinite(a) || a <= 0) return false;
      if (!Number.isFinite(p) || p <= 0) return false;
      return true;
    }

    if (name.trim().length < 2) return false;
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    return true;
  }, [showAdd, name, amount, value, selectedAsset, purchasePrice]);

  async function loadPrices(assetIds: string[], walletCurrency: string) {
    if (assetIds.length === 0) {
      setPrices({});
      return;
    }

    const vs = walletCurrency.toLowerCase() === "usd" ? "usd" : "eur";
    const r = await fetch(`/api/prices?assetIds=${encodeURIComponent(assetIds.join(","))}&vs=${vs}`, {
      cache: "no-store",
      credentials: "include",
    });

    if (!r.ok) return;

    const j = (await r.json()) as { results?: Array<{ assetId: string; price: number }> };
    const next: Record<string, number> = {};
    for (const row of j.results ?? []) next[row.assetId] = row.price;
    setPrices(next);
  }

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

    // transactions = source of truth
    const t = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/transactions`, {
      cache: "no-store",
      credentials: "include",
    });

    if (t.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    const txs = t.ok ? ((await t.json()) as WalletTx[]) : [];
    setTransactions(txs);

    // OTHER assets (môžu zostať v WalletAsset tabulke)
    const o = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/assets?kind=OTHER`, {
      cache: "no-store",
      credentials: "include",
    });

    if (o.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    const other = o.ok ? ((await o.json()) as WalletAsset[]) : [];
    setOtherAssets(other);

    // load live prices only for assets that appear in transactions (visible on this page)
    const txAssetIds = [...new Set(txs.map((x) => x.assetId).filter((x): x is string => typeof x === "string" && x.length > 0))];
    await loadPrices(txAssetIds, walletData.currency);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId]);

  // refresh prices every 60s while user is on this page
  useEffect(() => {
    if (!wallet) return;
    const assetIds = [...new Set(transactions.map((t) => t.assetId).filter(Boolean))];
    if (assetIds.length === 0) return;

    const timer = setInterval(() => {
      loadPrices(assetIds, wallet.currency);
    }, 60_000);

    return () => clearInterval(timer);
  }, [wallet, transactions]);

  function openAdd(kind: "MAIN" | "OTHER") {
    setShowAdd(kind);
    setName("");
    setAmount("");
    setValue("");
    setAssetQuery("");
    setPurchasePrice("");
    setAssetType("CRYPTO");
    setSuggestions([]);
    setSelectedAsset(null);
  }

  // autocomplete for MAIN assets (search in DB)
  useEffect(() => {
    if (showAdd !== "MAIN") return;

    const q = assetQuery.trim();
    const h = setTimeout(async () => {
      if (q.length < 1) {
        setSuggestions([]);
        return;
      }
      const r = await fetch(
        `/api/catalog/assets?q=${encodeURIComponent(q)}&types=${encodeURIComponent(assetType)}&limit=10`,
        { cache: "no-store", credentials: "include" }
      );
      if (r.status === 401) {
        window.location.href = "/auth/login";
        return;
      }
      const j = await r.json().catch(() => []);
      setSuggestions(Array.isArray(j) ? (j as CatalogAsset[]) : []);
    }, 250);

    return () => clearTimeout(h);
  }, [showAdd, assetQuery, assetType]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!showAdd) return;

    setSaving(true);
    setError(null);

    const payload: any = { kind: showAdd };

    if (showAdd === "MAIN") {
      payload.assetId = selectedAsset?.id;
      payload.amount = Number(amount);
      payload.pricePerUnit = Number(purchasePrice);
      // backend ti to uloží ako Transaction (BUY) + (ak si nechal) aktualizuje WalletAsset
    } else {
      payload.name = name.trim();
      payload.value = Number(value);
    }

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

  // OTHER delete necháme (OTHER nemá transakcie)
  async function removeOther(id: string) {
    if (!confirm("Naozaj odstrániť položku?")) return;

    const r = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/assets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (r.status === 401) {
      window.location.href = "/auth/login";
      return;
    }
    if (!r.ok) {
      setError("Odstránenie zlyhalo.");
      return;
    }

    setOtherAssets((p) => p.filter((x) => x.id !== id));
  }

  const fmtSigned2 = (s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    return n.toLocaleString("sk-SK", { maximumFractionDigits: 2, signDisplay: "always" });
  };

  // ---- MAIN assets derived from transactions (source of truth) ----
  const holdings = useMemo(() => {
    const map = new Map<string, { assetId: string; symbol: string; name: string; qty: number }>();

    for (const t of transactions) {
      const q = Number(t.quantity ?? "0");
      if (!Number.isFinite(q) || q <= 0) continue;

      const key = t.assetId;
      const symbol = t.asset?.symbol ?? "???";
      const name = t.asset?.name ?? "";

      const row = map.get(key);
      const delta = t.type === "SELL" ? -q : q;

      if (!row) map.set(key, { assetId: key, symbol, name, qty: delta });
      else row.qty += delta;
    }

    return Array.from(map.values())
      .filter((x) => x.qty > 0)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [transactions]);

  const currentValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const p = prices[h.assetId] ?? 0;
      const v = h.qty * p;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [holdings, prices]);

  const invested = useMemo(() => {
    return transactions.reduce((sum, t) => {
      if (t.type !== "BUY") return sum;
      const q = Number(t.quantity);
      const p = Number(t.pricePerUnit ?? "0");
      const v = q * p;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [transactions]);

  const totalPL = useMemo(() => currentValue - invested, [currentValue, invested]);

  // ---- early returns AFTER hooks ----
  if (loading) return <div style={{ padding: 24 }}>Načítavam...</div>;
  if (!wallet) return <div style={{ padding: 24, color: "tomato" }}>{error ?? "Wallet nenájdená."}</div>;

  const displayWallet = wallet;

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
          <WalletValueChart transactions={transactions} currency={displayWallet.currency} totalPL={totalPL} />
        </div>

        {/* MAIN ASSETS (derived from transactions) */}
        <div className="asset-card">
          <div className="asset-card-header">
            <h2>Main assets</h2>
            <button type="button" className="btn-primary btn-small" onClick={() => openAdd("MAIN")}>
              Add asset
            </button>
          </div>

          <div className="asset-list">
            {holdings.length === 0 ? (
              <p>No main assets yet.</p>
            ) : (
              holdings.map((h) => {
                const price = prices[h.assetId];
                const val = (price ?? 0) * h.qty;

                return (
                  <div key={h.assetId} className="asset-row">
                    <div className="asset-row-main">
                      <div className="wallet-name">{h.symbol}</div>
                      <div className="wallet-meta">
                        amount: {h.qty.toLocaleString("sk-SK", { maximumFractionDigits: 8 })} | price:{" "}
                        {price !== undefined ? price.toLocaleString("sk-SK", { maximumFractionDigits: 2 }) : "-"}{" "}
                        {displayWallet.currency} | value:{" "}
                        {Number.isFinite(val) ? val.toLocaleString("sk-SK", { maximumFractionDigits: 2 }) : "-"}{" "}
                        {displayWallet.currency}
                      </div>
                    </div>
                    {/* ❌ Delete removed – edit/delete is in Transaction history */}
                  </div>
                );
              })
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
                    <button type="button" className="btn-ghost btn-small" onClick={() => removeOther(asset.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ADD MODAL */}
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

            <form onSubmit={createItem} className="asset-form" style={{ marginTop: 12, color: "black" }}>
              {showAdd === "MAIN" ? (
                <>
                  <label className="form-field">
                    <span>Type</span>
                    <select
                      value={assetType}
                      onChange={(e) => {
                        setAssetType(e.target.value as any);
                        setSuggestions([]);
                        setSelectedAsset(null);
                      }}
                    >
                      <option value="CRYPTO">Crypto</option>
                      <option value="STOCK">Stock</option>
                      <option value="ETF">ETF</option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Search asset</span>
                    <input
                      value={assetQuery}
                      onChange={(e) => {
                        setAssetQuery(e.target.value);
                        setSelectedAsset(null);
                      }}
                      placeholder="Start typing... (BTC, Apple, SPY...)"
                    />
                  </label>

                  {selectedAsset ? (
                    <div style={{ padding: 10, border: "1px solid #333", borderRadius: 8, background: "#fff" }}>
                      Selected: <b>{selectedAsset.symbol}</b> — {selectedAsset.name}
                      {selectedAsset.exchange ? ` (${selectedAsset.exchange})` : ""}
                      <button
                        type="button"
                        style={{
                          marginLeft: 10,
                          textDecoration: "underline",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedAsset(null)}
                      >
                        change
                      </button>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div style={{ border: "1px solid #333", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedAsset(s);
                            setSuggestions([]);
                            setAssetQuery(`${s.symbol}`);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 10,
                            border: "none",
                            borderTop: "1px solid #eee",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <b>{s.symbol}</b> — {s.name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <label className="form-field">
                    <span>Amount</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 0.5" />
                  </label>

                  <label className="form-field">
                    <span>Purchase price (per 1 unit) in {displayWallet.currency}</span>
                    <input
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder={displayWallet.currency === "EUR" ? "e.g. 25000" : "e.g. 27000"}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="form-field">
                    <span>Name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. savings, debt..." />
                  </label>

                  <label className="form-field">
                    <span>Value ({displayWallet.currency})</span>
                    <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 500 or -50" />
                  </label>
                </>
              )}

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
