export function analyzeWallet(address: string) {
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);

  if (!isValid) {
    return null;
  }

  return {
    address,
    firstTransaction: '2021-05-18',
    totalTransactions: '18,420',
    activeNetworks: ['Ethereum', 'Arbitrum', 'Base', 'Polygon'],
    riskScore: 24,
    defiActivity: 'High',
    nftActivity: 'Medium'
  };
}
