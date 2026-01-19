"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Tx = {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: string;
  pricePerUnit: string | null;
};

export function WalletValueChart({
  transactions,
  currency,
  totalPL,
}: {
  transactions: Tx[];
  currency: string;
  totalPL: number;
}) {
  let cum = 0;

  const data = transactions
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => {
      const q = Number(t.quantity);
      const p = Number(t.pricePerUnit ?? "0");

      if (t.type === "BUY") cum += q * p;
      if (t.type === "SELL") cum -= q * p;

      return {
        date: new Date(t.date).toLocaleDateString("sk-SK"),
        invested: Number(cum.toFixed(2)),
      };
    });

  return (
    <div className="asset-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Value over time</h2>
        <div style={{ fontWeight: 700 }}>
          P/L: {totalPL >= 0 ? "+" : ""}{totalPL.toFixed(2)} {currency}
        </div>
      </div>

      <div style={{ width: "100%", height: 260, marginTop: 10 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="invested" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p style={{ opacity: 0.7, marginTop: 10 }}>
        Chart shows cumulative invested value based on transactions (cost basis).
      </p>
    </div>
  );
}
