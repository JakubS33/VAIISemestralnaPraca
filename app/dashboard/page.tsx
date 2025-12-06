// app/dashboard/page.tsx
import Link from "next/link";
type DemoWallet = {
  id: string;
  name: string;
  value: number; // aktuálna hodnota
  pnl: number; // zisk/strata
};

const demoWallets: DemoWallet[] = [
  { id: "1", name: "Long-term ETF", value: 8600.53, pnl: 1200 },
  { id: "2", name: "Crypto DCA", value: 4200, pnl: -300 },
  { id: "3", name: "Cash & savings", value: 2500, pnl: 0 },
];

function getTotals(wallets: DemoWallet[]) {
  const totalValue = wallets.reduce((sum, w) => sum + w.value, 0);
  const totalPnL = wallets.reduce((sum, w) => sum + w.pnl, 0);
  return { totalValue, totalPnL };
}

export default function DashboardPage() {
  const { totalValue, totalPnL } = getTotals(demoWallets);

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back</h1>
        <p>
          Here is a quick summary of your virtual portfolio. Manage your
          wallets, add new assets and check your overall status.
        </p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-actions">
          <div className="action-card">
            <h2>Check my wallets</h2>
            <p>See all your virtual wallets with current value and P/L.</p>
            <Link href="/wallets" className="btn-primary">
              Go to wallets
            </Link>
          </div>

          <div className="action-card">
            <h2>Add a new wallet</h2>
            <p>Create a separate wallet for crypto, ETFs or savings.</p>
            <Link href="/wallets" className="btn-secondary">
              Add wallet
            </Link>
          </div>

          <div className="action-card">
            <h2>See overall status</h2>
            <p>
              Combine investments, cash and other assets to see your net worth.
            </p>
            <Link href="/wallets" className="btn-ghost">
              Open detailed view
            </Link>
          </div>
        </div>

        <aside className="dashboard-summary">
          <div className="summary-card">
            <h2>Portfolio overview</h2>

            <p className="summary-value">
              Total value:{" "}
              <span>
                €
                {totalValue.toLocaleString("sk-SK", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>

            <p className="summary-pnl">
              Overall P/L:{" "}
              <span className={totalPnL >= 0 ? "pnl-positive" : "pnl-negative"}>
                €
                {totalPnL.toLocaleString("sk-SK", {
                  signDisplay: "always",
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>
           
            <ul className="summary-list">
                {demoWallets.map((w) => (
                  <li key={w.id} >
                    <span>{w.name}</span>
                    <span> 
                      €
                      {w.value.toLocaleString("sk-SK", {
                        maximumFractionDigits: 2,
                      })}
                    </span>

                  </li>
                ))}
            </ul>

            

            <p className="summary-foot">
              Values are demo data – later there will be connected DB & APIs.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
