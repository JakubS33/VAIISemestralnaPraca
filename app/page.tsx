// app/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const userId = token ? verifySessionToken(token) : null;
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null;

  // Logged-in home: quick actions + personalised message
  if (user) {
    return (
      <section className="hero">
        <div className="hero-inner container">
          <div className="hero-text">
            <span className="hero-badge">Welcome back</span>

            <h1 className="hero-title">
              Ready to manage your <span style={{ color: "#f97373" }}>portfolio</span>?
            </h1>

            <p className="hero-subtitle">
              Signed in as <b>{user.email}</b>. Jump straight to your wallets, dashboard, analytics or account settings.
            </p>

            <div className="hero-buttons">
              <Link href="/dashboard" className="btn-primary">
                Open dashboard
              </Link>
              <Link href="/wallets" className="btn-secondary">
                Open wallets
              </Link>
              <Link href="/analytics" className="btn-ghost">
                Analytics
              </Link>
              <Link href="/account" className="btn-ghost">
                Account
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-card">
              <p className="hero-card-label">Quick tip</p>
              <p className="hero-card-value" style={{ fontSize: "1.4rem" }}>
                Add transactions to build history
              </p>
              <p className="hero-card-small">
                Your wallet charts can use snapshots (value checkpoints) to show a timeline even when you don’t add new assets every day.
              </p>
              <div className="hero-card-row">
                <span>Manage</span>
                <span>Wallets</span>
              </div>
              <div className="hero-card-row">
                <span>Update</span>
                <span>Account</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Public home
  return (
    <section className="hero">
      <div className="hero-inner container">
        <div className="hero-text">
          <span className="hero-badge">My Finance Hub</span>

          <h1 className="hero-title">
            One place for your <span style={{ color: "#f97373" }}>real</span> financial picture.
          </h1>

          <p className="hero-subtitle">
            Track your crypto, ETFs, stocks and cash in a single virtual wallet. See your net worth and profit / loss without logging into many different apps.
          </p>

          <div className="hero-buttons">
            <Link href="/auth/register" className="btn-primary">
              Create free account
            </Link>
            <Link href="/auth/login" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-card">
            <p className="hero-card-label">Demo preview</p>
            <p className="hero-card-value">18 655€</p>
            <p className="hero-card-small">Current estimated net worth</p>
            <p className="hero-card-small" style={{ color: "green" }}>P/L +1500€</p>

            <div className="hero-card-row">
              <span>Crypto 1205 €</span>
            </div>
            <div className="hero-card-row">
              <span>ETFs 15 300 €</span>
            </div>
            <div className="hero-card-row">
              <span>Stocks 1900 €</span>
            </div>
            <div className="hero-card-row">
              <span>other assets 250 €</span>
            </div>
            <p className="hero-card-foot">Log in to see your own numbers.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
