import TransactionsClient from "./TransactionsClient";

export default async function TransactionsPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  return <TransactionsClient walletId={walletId} />;
}
