// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Finance Hub",
  description: "Simple way to see your real financial picture",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body>
        <header className="main-header">
          <div className="header-inner container">
            <Link href="/" className="logo">
              My Finance Hub
            </Link>

            <nav className="main-nav">
              <Link href="/dashboard" className="nav-link">
                Dashboard
              </Link>
              <Link href="/wallets" className="nav-link">
                Wallets
              </Link>
              <Link href="/auth/login" className="nav-link nav-link--cta">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        <main className="page-content container">{children}</main>

        <footer className="main-footer">
          <div className="container">
            <small>© {new Date().getFullYear()} My Finance Hub</small>
          </div>
        </footer>
      </body>
    </html>
  );
}
