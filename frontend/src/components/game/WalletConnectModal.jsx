import { useState } from "react";
import { LoaderCircle, Wallet, X } from "lucide-react";
import {
  WalletCoinbase,
  WalletMetamask,
  WalletWalletConnect,
  WalletPhantom,
  WalletRabby,
} from "@web3icons/react";

function getConnectorLabel(connector) {
  const id = connector.id.toLowerCase();
  if (id.includes("metamask")) return "MetaMask";
  if (id.includes("coinbase")) return "Coinbase Wallet";
  if (id.includes("walletconnect")) return "WalletConnect";
  if (id.includes("phantom")) return "Phantom";
  if (id.includes("rabby")) return "Rabby";
  if (connector.name.toLowerCase() === "injected") return "Browser Wallet";
  return connector.name;
}

function ProviderIcon({ connector }) {
  const id = connector.id.toLowerCase();
  const iconProps = { size: 30, variant: "branded" };

  if (id.includes("metamask")) return <WalletMetamask {...iconProps} />;
  if (id.includes("coinbase")) return <WalletCoinbase {...iconProps} />;
  if (id.includes("walletconnect")) return <WalletWalletConnect size={30} variant="background" />;
  if (id.includes("phantom")) return <WalletPhantom {...iconProps} />;
  if (id.includes("rabby")) return <WalletRabby {...iconProps} />;
  return <Wallet className="h-4 w-4" />;
}

export function WalletConnectModal({ open, connectors, onConnect, onClose }) {
  const [pendingConnector, setPendingConnector] = useState(null);

  if (!open) return null;

  const uniqueConnectors = connectors.filter((connector, index, list) =>
    list.findIndex((candidate) => getConnectorLabel(candidate) === getConnectorLabel(connector)) === index
  );

  async function connect(connector) {
    setPendingConnector(connector.uid);
    const connected = await onConnect(connector);
    setPendingConnector(null);
    if (connected) onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close wallet selection"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-connect-title"
        className="relative w-full max-w-md border border-border bg-card shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="wallet-connect-title" className="text-base font-bold text-foreground">Connect a wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a provider to continue.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-2 p-4">
          {uniqueConnectors.map((connector) => (
            <button
              type="button"
              key={connector.uid}
              disabled={pendingConnector !== null}
              onClick={() => connect(connector)}
              className="flex min-h-14 items-center gap-3 border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-muted/60 disabled:opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-background">
                {pendingConnector === connector.uid
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <ProviderIcon connector={connector} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{getConnectorLabel(connector)}</span>
                <span className="block text-xs text-muted-foreground">Connect using {getConnectorLabel(connector)}</span>
              </span>
            </button>
          ))}
          {uniqueConnectors.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">No wallet providers are available in this browser.</p>
          )}
        </div>
      </section>
    </div>
  );
}
