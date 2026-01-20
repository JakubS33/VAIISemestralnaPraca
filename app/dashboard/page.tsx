// app/dashboard/page.tsx
import Link from "next/link";
import Image from "next/image";

type DemoWallet = {
  id: string;
  name: string;
  value: number;
  pnl: number;
};





export default function DashboardPage() {
  

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1 style={{fontSize: 30}}>Welcome back</h1>
        <p>
            <span style={{ color: "red" }}>Manage </span>
             your wallets, 
             <span style={{ color: "red" }}> add </span> 
             new assets and 
             <span style={{ color: "red" }}> check </span>
             your overall status.
          
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
            <h2>Charts & insights</h2>
            <p>See overall value and performance of your account.</p>
            <Link href="/analytics" className="btn-secondary">
              Open analytics
            </Link>
          </div>

          <div className="action-card">
            <h2>Account settings</h2>
            <p>Update your email or password.</p>
            <Link href="/account" className="btn-secondary">
              Edit account
            </Link>
          </div>
        </div>

        <aside className="dashboard-summary">
          <div className="banner-card" aria-label="Dashboard banner">
            <Image
              src="/FinanceHubBanner.png"
              alt="My Finance Hub dashboard banner"
              width={900}
              height={1400}
              priority
              className="dashboard-banner"
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
