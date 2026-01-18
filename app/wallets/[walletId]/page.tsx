import WalletOverviewClient from "./walletOverviewClient";

export default async function WalletOverviewPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;
  return <WalletOverviewClient walletId={walletId} />;
}
