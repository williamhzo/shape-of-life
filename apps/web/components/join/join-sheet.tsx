"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJoinFlow } from "@/hooks/use-join-flow";
import type { ParticipantEntry } from "@/lib/round-feeds";
import { WalletConnectSection } from "./wallet-connect-section";
import { TeamSelect } from "./team-select";
import { SlotPicker } from "./slot-picker";
import { SeedEditor } from "./seed-editor";
import { TransactionActions } from "./transaction-actions";

export function JoinSheet({ participants }: { participants: ParticipantEntry[] }) {
  const isMobile = useIsMobile();
  const flow = useJoinFlow();

  const content = (
    <div className="space-y-4 text-sm">
      <WalletConnectSection
        isConnected={flow.isConnected}
        account={flow.account}
        chainId={flow.chainId}
        connectors={flow.connectors}
        isConnectPending={flow.isConnectPending}
        isSwitchPending={flow.isSwitchPending}
        disconnect={flow.disconnect}
        connectWallet={flow.connectWallet}
        switchToTargetNetwork={flow.switchToTargetNetwork}
        onboarding={flow.onboarding}
        shortenAddress={flow.shortenAddress}
      />
      <Separator />
      <div className="space-y-1">
        <p className="text-xs font-medium">Team</p>
        <TeamSelect team={flow.draft.team} disabled={flow.editorDisabled} onTeamSelect={flow.handleTeamSelect} />
      </div>
      <Separator />
      <div className="space-y-1">
        <p className="text-xs font-medium">Slot</p>
        <SlotPicker
          team={flow.draft.team}
          slotIndex={flow.draft.slotIndex}
          disabled={flow.editorDisabled}
          participants={participants}
          onSlotSelect={(i) => flow.updateDraft("slotIndex", i)}
        />
      </div>
      <Separator />
      <div className="space-y-1">
        <p className="text-xs font-medium">Seed</p>
        <SeedEditor
          draft={flow.draft}
          liveCells={flow.liveCells}
          budgetProgress={flow.budgetProgress}
          editorDisabled={flow.editorDisabled}
          seedPresets={flow.seedPresets}
          applyPreset={flow.applyPreset}
          handleSeedCellToggle={flow.handleSeedCellToggle}
          transformSeed={flow.transformSeed}
          translateSeed={flow.translateSeed}
          updateDraft={flow.updateDraft}
        />
      </div>
      <Separator />
      <TransactionActions
        draft={flow.draft}
        updateDraft={flow.updateDraft}
        editorDisabled={flow.editorDisabled}
        txControlsDisabled={flow.txControlsDisabled}
        txFeedback={flow.txFeedback}
        txStageLabel={flow.txStageLabel}
        txBadgeVariant={flow.txBadgeVariant}
        pendingAction={flow.pendingAction}
        displayedStatus={flow.displayedStatus}
        sendTransaction={flow.sendTransaction}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Join Round</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Join Round</DrawerTitle>
            <DrawerDescription>Pick a team, choose your slot, design your seed.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[70dvh] overflow-y-auto px-4 pb-4" style={{ overscrollBehaviorY: "contain" }}>
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Join Round</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] overflow-y-auto sm:w-[540px]" style={{ overscrollBehaviorY: "contain" }}>
        <SheetHeader>
          <SheetTitle>Join Round</SheetTitle>
          <SheetDescription>Pick a team, choose your slot, design your seed.</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
