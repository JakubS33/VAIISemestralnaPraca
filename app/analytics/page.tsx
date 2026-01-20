"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatFull(n: number) {
  return new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(n);
}

type Summary = {
  vs: "eur" | "usd";
  currentTotalValue: number;
  overallPL: number;
  allocation: { name: string; value: number }[];
  timeSeries: { date: string; value: number }[];
};

const PIE_COLORS: Record<string, string> = {
  Crypto: "#22c55e",   // green
  Stocks: "#3b82f6",   // blue
  ETFs: "#a855f7",     // purple
  Other: "#f97316",    // orange
};




export default function AnalyticsPage() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);

  // currency pre UI (EUR/USD)
  const currency = data?.vs === "usd" ? "USD" : "EUR";
  const plClass = (data?.overallPL ?? 0) >= 0 ? "pnl-positive" : "pnl-negative";

  
  React.useEffect(() => {
    let cancel = false;

    async function run() {
      setLoading(true);
      const r = await fetch(`/api/analytics/summary?vs=eur`, { cache: "no-store", credentials: "include" });
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const j = (await r.json()) as Summary;

      // preformat date na sk-SK pre X axis
      const series = (j.timeSeries ?? []).map((x) => ({
        ...x,
        date: new Date(x.date).toLocaleDateString("sk-SK"),
      }));

      if (!cancel) setData({ ...j, timeSeries: series });
      setLoading(false);
    }

    run();
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!data) return <div style={{ padding: 24, color: "tomato" }}>Failed to load analytics.</div>;


  const totalAlloc = data.allocation.reduce((s, x) => s + (Number.isFinite(x.value) ? x.value : 0), 0);

  const allocWithPct = data.allocation.map((x) => {
  const pct = totalAlloc > 0 ? (x.value / totalAlloc) * 100 : 0;
  return { ...x, pct };
  });


  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1>Analytics</h1>
        <p>Aggregated portfolio analytics across all your wallets.</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-actions">
          <div className="action-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
              <h2 style={{ margin: 0 }}>Total value</h2>
              <div style={{ textAlign: "right" }}>
                <div className="hero-card-small" style={{ margin: 0, opacity: 0.8 }}>Overall P/L</div>
                <div className={plClass} style={{ fontWeight: 800, fontSize: 22 }}>
                  {data.overallPL >= 0 ? "+" : ""}
                  {formatMoney(data.overallPL, currency)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
              Current total value: {formatMoney(data.currentTotalValue, currency)}
            </div>

            <div style={{ width: "100%", height: 320, marginTop: 12 }}>
              <ResponsiveContainer>
                <LineChart data={data.timeSeries} margin={{ top: 12, right: 16, bottom: 8, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis dataKey="date" tickMargin={10} minTickGap={24} axisLine={false} tickLine={false} />
                  <YAxis
                    width={80}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatFull(Number(v))}
                    tickCount={6}
                  />
                  <Tooltip
                    formatter={(val) => [formatMoney(Number(val), currency), "Total value"]}
                    labelStyle={{ fontWeight: 700 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }}
                  />
                  <Line type="monotone" dataKey="value" dot={false} strokeWidth={3} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="hero-card-small" style={{ marginBottom: 0 }}>
              Line chart uses aggregated wallet snapshots (sum across wallets per day).
            </p>
          </div>

          <div className="action-card">
            <h2>Allocation</h2>
            <p className="hero-card-small" style={{ marginTop: 0 }}>
              Split of your current value by category.
            </p>

            <div style={{ width: "100%", height: 320 }}>
  <ResponsiveContainer>
    <PieChart>
      <Pie
        data={allocWithPct}
        dataKey="value"
        nameKey="name"
        outerRadius={115}
        innerRadius={65}
        paddingAngle={3}
      >
        {allocWithPct.map((entry, idx) => (
          <Cell key={idx} fill={PIE_COLORS[entry.name] ?? "#64748b"} />
        ))}
      </Pie>

      <Legend
        verticalAlign="bottom"
        height={42}
        formatter={(value: any) => {
          const name = String(value);
          const row = allocWithPct.find((x) => x.name === name);
          const pct = row?.pct ?? 0;
          const color = PIE_COLORS[name] ?? "#e5e7eb";

          return (
            <span style={{ color: "#e5e7eb", fontWeight: 600 }}>
              <span style={{ color }}>{name}</span>{" "}
              <span style={{ color, fontWeight: 700 }}>
                {pct.toFixed(1)}%
              </span>
            </span>
          );
        }}
      />

      <Tooltip
        formatter={(val, name) => [formatMoney(Number(val), currency), String(name)]}
        contentStyle={{
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "#e3e4e7",
          
        }}
      />
    </PieChart>
  </ResponsiveContainer>
</div>


            <ul className="summary-list" style={{ marginTop: 8 }}>
              {data.allocation.map((x) => (
                <li key={x.name}>
                  <span>{x.name}</span>
                  <span>{formatMoney(x.value, currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="dashboard-summary">
          <div className="summary-card">
            <h2>Notes</h2>
            <p className="hero-card-small" style={{ marginTop: 0 }}>
              Total value is computed from live prices (CoinGecko/TwelveData) + OTHER assets values.
              P/L is computed as (current assets total value - invested BUY cost basis).
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
