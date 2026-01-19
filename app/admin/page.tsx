"use client";

import { useEffect, useMemo, useState } from "react";

type UserRow = { id: string; email: string; role: "USER" | "ADMIN"; walletCount: number };
type AssetRow = {
  id: string;
  type: string;
  symbol: string;
  name: string;
  provider: string;
  apiId: string | null;
  exchange: string | null;
  createdAt: string;
};

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? "Request failed");
  return j as T;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "assets">("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [qAssets, setQAssets] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await jsonFetch<UserRow[]>("/api/admin/users");
      setUsers(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadAssets() {
    setLoading(true);
    setErr(null);
    try {
      const url = qAssets.trim() ? `/api/admin/assets?q=${encodeURIComponent(qAssets.trim())}` : "/api/admin/assets";
      const rows = await jsonFetch<AssetRow[]>(url);
      setAssets(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "users") loadUsers();
    else loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const header = useMemo(() => {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Admin</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTab("users")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer", opacity: tab === "users" ? 1 : 0.6 }}
          >
            Users
          </button>
          <button
            onClick={() => setTab("assets")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer", opacity: tab === "assets" ? 1 : 0.6 }}
          >
            Assets
          </button>
        </div>
      </div>
    );
  }, [tab]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      {header}

      <p style={{ marginTop: 8, opacity: 0.75 }}>
        Admin účet nemá prístup k wallets/dashboard. Tu vieš spravovať používateľov a mazať assety.
      </p>

      {err ? <div style={{ marginTop: 10, color: "tomato" }}>{err}</div> : null}

      {tab === "users" ? (
        <UsersSection
          loading={loading}
          users={users}
          onReload={loadUsers}
          onUpdate={async (id, patch) => {
            await jsonFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
            await loadUsers();
          }}
          onDelete={async (id) => {
            await jsonFetch(`/api/admin/users/${id}`, { method: "DELETE" });
            await loadUsers();
          }}
        />
      ) : (
        <AssetsSection
          loading={loading}
          assets={assets}
          q={qAssets}
          setQ={setQAssets}
          onSearch={loadAssets}
          onDelete={async (assetId) => {
            await jsonFetch(`/api/admin/assets/${assetId}`, { method: "DELETE" });
            await loadAssets();
          }}
        />
      )}
    </div>
  );
}

function UsersSection(props: {
  loading: boolean;
  users: UserRow[];
  onReload: () => void;
  onUpdate: (id: string, patch: { email?: string; role?: "USER" | "ADMIN"; password?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { loading, users, onReload, onUpdate, onDelete } = props;
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Users</h2>
        <button onClick={onReload} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}>
          Reload
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Wallets</th>
              <th style={th}>New password</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRowItem
                key={u.id}
                u={u}
                busy={busyId === u.id}
                onBusy={(b) => setBusyId(b ? u.id : null)}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {loading ? <div style={{ marginTop: 10, opacity: 0.7 }}>Loading...</div> : null}
    </div>
  );
}

function UserRowItem(props: {
  u: UserRow;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onUpdate: (id: string, patch: { email?: string; role?: "USER" | "ADMIN"; password?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { u, busy, onBusy, onUpdate, onDelete } = props;
  const [email, setEmail] = useState(u.email);
  const [role, setRole] = useState<UserRow["role"]>(u.role);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setEmail(u.email);
    setRole(u.role);
    setPassword("");
  }, [u.email, u.role]);

  const changed = email.trim().toLowerCase() !== u.email || role !== u.role || password.length > 0;

  return (
    <tr>
      <td style={td}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} disabled={busy} />
      </td>
      <td style={td}>
        <select value={role} onChange={(e) => setRole(e.target.value as any)} style={input} disabled={busy}>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </td>
      <td style={td}>{u.walletCount}</td>
      <td style={td}>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          placeholder="(optional)"
          disabled={busy}
        />
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!changed || busy}
            onClick={async () => {
              onBusy(true);
              try {
                await onUpdate(u.id, {
                  email: email.trim().toLowerCase() !== u.email ? email.trim().toLowerCase() : undefined,
                  role: role !== u.role ? role : undefined,
                  password: password ? password : undefined,
                });
              } finally {
                onBusy(false);
              }
            }}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #333", cursor: busy ? "not-allowed" : "pointer", opacity: !changed ? 0.5 : 1 }}
          >
            Save
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Delete user ${u.email}? This will also delete their wallets/transactions.`)) return;
              onBusy(true);
              try {
                await onDelete(u.id);
              } finally {
                onBusy(false);
              }
            }}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #333", cursor: busy ? "not-allowed" : "pointer" }}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function AssetsSection(props: {
  loading: boolean;
  assets: AssetRow[];
  q: string;
  setQ: (v: string) => void;
  onSearch: () => void;
  onDelete: (assetId: string) => Promise<void>;
}) {
  const { loading, assets, q, setQ, onSearch, onDelete } = props;
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Assets</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol/name" style={input} />
          <button onClick={onSearch} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}>
            Search
          </button>
        </div>
      </div>

      <p style={{ marginTop: 8, opacity: 0.75 }}>
        Mazanie assetu vymaže aj všetky transakcie a walletAssets, ktoré naň odkazujú.
      </p>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Type</th>
              <th style={th}>Symbol</th>
              <th style={th}>Name</th>
              <th style={th}>Provider</th>
              <th style={th}>API id</th>
              <th style={th}>Exchange</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.type}</td>
                <td style={td}>{a.symbol}</td>
                <td style={td}>{a.name}</td>
                <td style={td}>{a.provider}</td>
                <td style={td}>{a.apiId ?? "-"}</td>
                <td style={td}>{a.exchange ?? "-"}</td>
                <td style={td}>
                  <button
                    disabled={busy === a.id}
                    onClick={async () => {
                      if (!confirm(`Delete asset ${a.symbol} (${a.type})? This will delete related transactions.`)) return;
                      setBusy(a.id);
                      try {
                        await onDelete(a.id);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #333", cursor: busy === a.id ? "not-allowed" : "pointer" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? <div style={{ marginTop: 10, opacity: 0.7 }}>Loading...</div> : null}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #333",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(51,51,51,0.35)",
  verticalAlign: "top",
};

const input: React.CSSProperties = {
  padding: 8,
  borderRadius: 10,
  border: "1px solid #333",
  minWidth: 180,
};
