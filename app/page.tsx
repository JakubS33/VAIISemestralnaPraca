// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero-inner container">
        <div className="hero-text">
          <span className="hero-badge">My Finance Hub</span>

          <h1 className="hero-title">
            One place for your <span className="hero-highlight">real</span>{" "}
            financial picture.
          </h1>

          <p className="hero-subtitle">
            Track your crypto, ETFs, stocks and cash in a single virtual
            wallet. See your net worth and profit / loss without
            logging into many different apps.
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
            <p className="hero-card-value">€18 420</p>
            <p className="hero-card-small">Estimated net worth</p>

            <div className="hero-card-row">
              <span>Crypto & stocks</span>
              <span>+€1 230 (24h)</span>
            </div>
            <div className="hero-card-row">
              <span>Cash & other assets</span>
              <span>€4 500</span>
            </div>
            <p className="hero-card-foot">
              Log in to see your own numbers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
