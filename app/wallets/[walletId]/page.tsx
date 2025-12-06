// app/wallets/[walletId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Wallet {
  id: string;
  name: string;
  currency: string;
}

type AssetKind = "main" | "other";

interface Asset {
  id: string;
  walletId: string;
  kind: AssetKind;
  name: string;
  amount?: number;
  value: number;
}


const MAIN_ASSET_OPTIONS = [
  { id: "BTC", name: "Bitcoin (BTC)", unitPrice: 50000 },
  { id: "SP500", name: "S&P 500 ETF", unitPrice: 400 },
  { id: "GOLD", name: "Gold ETF", unitPrice: 60 },
];

export default function WalletDetailPage() {
 
  const params = useParams<{ walletId?: string}>();
  const walletId = (params.walletId ?? "").toString();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mainAssets, setMainAssets] = useState<Asset[]>([]);
  const [otherAssets, setOtherAssets] = useState<Asset[]>([]);

  
  const [selectedMainId, setSelectedMainId] = useState<string>(
    MAIN_ASSET_OPTIONS[0]?.id ?? ""
  );
  const [mainAmount, setMainAmount] = useState("");
  const [editingMainId, setEditingMainId] = useState<string | null>(null);

  
  const [otherName, setOtherName] = useState("");
  const [otherValue, setOtherValue] = useState("");
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);

  
  useEffect(() => {
    if (!walletId) {
      setError("Missing wallet id in URL.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [walletRes, assetsRes] = await Promise.all([
          fetch("/api/wallets"),
          fetch(`/api/assets?walletId=${walletId}`),
        ]);

        const wallets: Wallet[] = await walletRes.json();
        const allAssets: Asset[] = await assetsRes.json();

        const found = wallets.find((w) => w.id === walletId);

        setWallet(
          found ?? {
            id: walletId,
            name: `Wallet #${walletId}`,
            currency: "EUR",
          }
        );

        setMainAssets(allAssets.filter((a) => a.kind === "main"));
        setOtherAssets(allAssets.filter((a) => a.kind === "other"));
      } catch (err) {
        console.error(err);
        setError("Failed to load wallet data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [walletId]);

  
  function getUnitPriceForMain(id: string): number {
    const opt = MAIN_ASSET_OPTIONS.find((o) => o.id === id);
    return opt?.unitPrice ?? 1;
  }

  // CREATE / UPDATE main asset
  async function handleSubmitMain(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNumber = Number(mainAmount.replace(",", "."));
    if (!amountNumber || amountNumber <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    const unitPrice = getUnitPriceForMain(selectedMainId);
    const value = amountNumber * unitPrice;

    const baseBody = {
      walletId,
      kind: "main" as const,
      name: selectedMainId,
      amount: amountNumber,
      value,
    };

    try {
      if (editingMainId) {
        const res = await fetch(`/api/assets?id=${editingMainId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseBody),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to update asset.");
          return;
        }

        setMainAssets((prev) =>
          prev.map((a) => (a.id === editingMainId ? data : a))
        );
        setEditingMainId(null);
      } else {
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseBody),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to create asset.");
          return;
        }

        setMainAssets((prev) => [...prev, data]);
      }

      setMainAmount("");
    } catch (err) {
      console.error(err);
      setError("Request failed.");
    }
  }

  // CREATE / UPDATE other asset
  async function handleSubmitOther(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!otherName.trim()) {
      setError("Name is required.");
      return;
    }

    const valueNumber = Number(otherValue.replace(",", "."));
    if (Number.isNaN(valueNumber)) {
      setError("Value must be a number (can be negative).");
      return;
    }

    const baseBody = {
      walletId,
      kind: "other" as const,
      name: otherName.trim(),
      value: valueNumber,
    };

    try {
      if (editingOtherId) {
        const res = await fetch(`/api/assets?id=${editingOtherId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseBody),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to update asset.");
          return;
        }

        setOtherAssets((prev) =>
          prev.map((a) => (a.id === editingOtherId ? data : a))
        );
        setEditingOtherId(null);
      } else {
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseBody),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to create asset.");
          return;
        }

        setOtherAssets((prev) => [...prev, data]);
      }

      setOtherName("");
      setOtherValue("");
    } catch (err) {
      console.error(err);
      setError("Request failed.");
    }
  }

  async function handleDeleteAsset(id: string, kind: AssetKind) {
    setError(null);
    try {
      const res = await fetch(`/api/assets?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete asset.");
        return;
      }

      if (kind === "main") {
        setMainAssets((prev) => prev.filter((a) => a.id !== id));
      } else {
        setOtherAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error(err);
      setError("Request failed.");
    }
  }

  function startEditMain(asset: Asset) {
    setEditingMainId(asset.id);
    setSelectedMainId(asset.name); 
    setMainAmount(asset.amount?.toString() ?? "");
  }

  function startEditOther(asset: Asset) {
    setEditingOtherId(asset.id);
    setOtherName(asset.name);
    setOtherValue(asset.value.toString());
  }

  if (loading) {
    return <p>Loading wallet...</p>;
  }

  
  const displayWallet: Wallet = wallet ?? {
    id: walletId || "unknown",
    name: walletId ? `Wallet #${walletId}` : "Unknown wallet",
    currency: "EUR",
  };

  return (
    <section className="wallet-detail">
      <header className="wallet-detail-header">
        <Link href="/wallets" className="btn-secondary">
          ← Back to wallets
        </Link>

        <div className="wallet-detail-title">
          <h1>{displayWallet.name}</h1>
          <p>Currency: {displayWallet.currency}</p>
        </div>

        <button className="btn-ghost" disabled>
          Check transaction history (coming soon)
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="wallet-detail-grid">
        <div className="wallet-detail-chart">
          <div className="asset-card">
            <h2>Value over time</h2>
            <p>(Chart placeholder – not implemented yet)</p>
          </div>
        </div>

        <div className="asset-card">
          <div className="asset-card-header">
            <h2>Main assets</h2>
          </div>

          <form onSubmit={handleSubmitMain} className="asset-form">
            <label className="form-field">
              <span>Select asset</span>
              <select
                value={selectedMainId}
                onChange={(e) => setSelectedMainId(e.target.value)}
              >
                {MAIN_ASSET_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Amount</span>
              <input
                value={mainAmount}
                onChange={(e) => setMainAmount(e.target.value)}
                placeholder="e.g. 0.5"
              />
            </label>

            <button type="submit" className="btn-primary btn-small">
              {editingMainId ? "Save changes" : "Add asset"}
            </button>
          </form>

          <div className="asset-list">
            {mainAssets.length === 0 ? (
              <p>No main assets yet.</p>
            ) : (
              mainAssets.map((asset) => (
                <div key={asset.id} className="asset-row">
                  <div className="asset-row-main">
                    <div className="wallet-name">{asset.name}</div>
                    <div className="wallet-meta">
                      amount: {asset.amount ?? "-"} | value:{" "}
                      {asset.value.toLocaleString("sk-SK", {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="wallet-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => startEditMain(asset)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => handleDeleteAsset(asset.id, "main")}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="asset-card">
          <div className="asset-card-header">
            <h2>Other assets</h2>
          </div>

          <form onSubmit={handleSubmitOther} className="asset-form">
            <label className="form-field">
              <span>Name</span>
              <input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="e.g. úspory, dlhy..."
              />
            </label>

            <label className="form-field">
              <span>Value (can be negative)</span>
              <input
                value={otherValue}
                onChange={(e) => setOtherValue(e.target.value)}
                placeholder="e.g. 500 or -50"
              />
            </label>

            <button type="submit" className="btn-primary btn-small">
              {editingOtherId ? "Save changes" : "Add asset"}
            </button>
          </form>

          <div className="asset-list">
            {otherAssets.length === 0 ? (
              <p>No other assets yet.</p>
            ) : (
              otherAssets.map((asset) => (
                <div key={asset.id} className="asset-row">
                  <div className="asset-row-main">
                    <div className="wallet-name">{asset.name}</div>
                    <div className="wallet-meta">
                      value:{" "}
                      {asset.value.toLocaleString("sk-SK", {
                        maximumFractionDigits: 2,
                        signDisplay: "always",
                      })}
                    </div>
                  </div>
                  <div className="wallet-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => startEditOther(asset)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => handleDeleteAsset(asset.id, "other")}
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
    </section>
  );
}
