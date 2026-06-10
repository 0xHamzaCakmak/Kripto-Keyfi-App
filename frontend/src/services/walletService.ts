import { getCurrentUser } from './userService';
import { updateAuthState } from './authService';

export type WalletProvider = 'MetaMask' | 'WalletConnect' | 'Coinbase Wallet' | 'Rabby Wallet' | 'Trust Wallet';

export function connectWalletMock(provider: WalletProvider) {
  const user = getCurrentUser();
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(updateAuthState({
        isWalletConnected: true,
        walletAddress: user.walletAddress,
        trustScore: provider === 'Rabby Wallet' ? user.trustScore + 1 : user.trustScore
      }));
    }, 700);
  });
}

export function disconnectWalletMock() {
  return updateAuthState({ isWalletConnected: false, walletAddress: undefined });
}
