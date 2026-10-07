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

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const runtimeKey = "__voltsonic_wagmi_runtime__";
const globalRuntime = globalThis;

const runtime = globalRuntime[runtimeKey] || (() => {
  const connectors = [
    metaMask(),
    coinbaseWallet({ appName: "VoltSonic" }),
    injected({
      shimDisconnect: true,
      target: {
        id: "rainbow",
        name: "Rainbow",
        provider: (window) => {
          const providers = window?.ethereum?.providers;
          return providers?.find((provider) => provider.isRainbow)
            ?? (window?.ethereum?.isRainbow ? window.ethereum : undefined);
        },
      },
    }),
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
      : []),
  ];

  const value = {
    connectors,
    config: createConfig({
      chains: [robinhoodTestnet],
      connectors,
      multiInjectedProviderDiscovery: false,
      transports: {
        [robinhoodTestnet.id]: http(
          import.meta.env.VITE_ROBINHOOD_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
        ),
      },
    }),
  };

  globalRuntime[runtimeKey] = value;
  return value;
})();

export const wagmiConnectors = runtime.connectors;
export const wagmiConfig = runtime.config;
