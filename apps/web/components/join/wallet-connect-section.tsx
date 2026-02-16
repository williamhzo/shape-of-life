"use client";

import { Button } from "@/components/ui/button";
import type { JoinFlowReturn } from "@/hooks/use-join-flow";

type WalletConnectSectionProps = Pick<
  JoinFlowReturn,
  | "isConnected"
  | "account"
  | "chainId"
  | "connectors"
  | "isConnectPending"
  | "isSwitchPending"
  | "disconnect"
  | "connectWallet"
  | "switchToTargetNetwork"
  | "onboarding"
  | "shortenAddress"
>;

export function WalletConnectSection({
  isConnected,
  account,
  chainId,
  connectors,
  isConnectPending,
  isSwitchPending,
  disconnect,
  connectWallet,
  switchToTargetNetwork,
  onboarding,
  shortenAddress,
}: WalletConnectSectionProps) {
  if (!isConnected) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => (
            <Button
              key={connector.uid}
              type="button"
              variant="outline"
              size="sm"
              disabled={isConnectPending}
              onClick={() => void connectWallet(connector)}
            >
              {isConnectPending ? `Connecting\u2026` : `Connect ${connector.name}`}
            </Button>
          ))}
        </div>
        {connectors.length === 0 ? (
          <p className="text-muted-foreground text-xs">No compatible wallet detected.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs">{account ? shortenAddress(account) : "Connected"}</span>
      <span className="text-muted-foreground text-xs">chain {chainId ?? "?"}</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
      {onboarding.stage === "switch-network" ? (
        <Button type="button" variant="secondary" size="sm" disabled={isSwitchPending} onClick={() => void switchToTargetNetwork()}>
          {isSwitchPending ? "Switching\u2026" : "Switch Network"}
        </Button>
      ) : null}
    </div>
  );
}
