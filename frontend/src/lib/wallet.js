import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

export const robinhoodTestnet = defineChain({
  id: Number(import.meta.env.VITE_ROBINHOOD_CHAIN_ID || 46630),
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ROBINHOOD_RPC_URL || "https://rpc.testnet.chain.robinhood.com"],
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: "VoltSonic" }),
    injected(),
    ...(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [robinhoodTestnet.id]: http(),
  },
});
