import Link from "next/link";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Link href={`/wallets/${walletId}`} style={{ textDecoration: "underline" }}>
        ← Späť na wallet
      </Link>

      <h1 style={{ marginTop: 12 }}>Transaction history</h1>
      <p style={{ opacity: 0.8 }}>Sem potom napojíme transakcie.</p>
    </div>
  );
}
