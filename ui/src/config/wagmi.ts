import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat, sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '88306a972a77389d91871e08d26516af';

export const wagmiConfig = getDefaultConfig({
  appName: 'Mindfold Zen',
  projectId,
  chains: [hardhat, sepolia],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
  },
  ssr: false,
});

