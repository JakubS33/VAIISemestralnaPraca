"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
} from "recharts";

export type WalletSnapshotRow = {
  id: string;
  date: string; // ISO
  value: string; // Decimal as string
  currency: string; // "EUR"/"USD"
  reason: string;
};

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCompact(n: number) {
  return new Intl.NumberFormat("sk-SK", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function WalletValueChart({
  snapshots,
  currency,
  totalPL,
}: {
  snapshots: WalletSnapshotRow[];
  currency: string;
  totalPL: number;
}) {
  const data = React.useMemo(() => {
    const sorted = snapshots
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted.map((s) => ({
      date: new Date(s.date).toLocaleDateString("sk-SK"),
      value: Number(Number(s.value).toFixed(2)),
    }));
  }, [snapshots]);

  const currentValue = React.useMemo(() => {
    if (data.length === 0) return 0;
    return Number(data[data.length - 1].value ?? 0);
  }, [data]);

  const plClass = totalPL >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="asset-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg font-semibold">Wallet value</h2>
          <div className="mt-1 text-sm opacity-70">
            Current: <span className="font-semibold opacity-100">{formatMoney(currentValue, currency)}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm opacity-70">Profit / Loss</div>
          <div className={`text-2xl font-bold ${plClass}`}>
            {totalPL >= 0 ? "+" : ""}
            {formatMoney(totalPL, currency)}
          </div>
        </div>
      </div>

      <div className="mt-4" style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
            <defs>
              <linearGradient id="walletValueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
            <XAxis dataKey="date" tickMargin={10} minTickGap={24} axisLine={false} tickLine={false} />
            <YAxis
              width={72}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCompact(Number(v))}
            />
            <Tooltip
              formatter={(val) => [formatMoney(Number(val), currency), "Value"]}
              labelStyle={{ fontWeight: 700 }}
              contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }}
            />

            <Area type="monotone" dataKey="value" stroke="currentColor" fill="url(#walletValueGradient)" fillOpacity={1} />
            <Line type="monotone" dataKey="value" dot={false} strokeWidth={3} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-sm opacity-70">
        Chart uses wallet snapshots saved after transaction changes and once per day when you open this wallet.
      </p>
    </div>
  );
}
