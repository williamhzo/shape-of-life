"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeeperFeed } from "@/components/keeper-feed";
import { ParticipantList } from "@/components/participant-list";
import type { ParticipantEntry, KeeperEntry } from "@/lib/round-feeds";

export function RoundInfoCollapsible({
  participants,
  keepers,
}: {
  participants: ParticipantEntry[];
  keepers: KeeperEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          {open ? "Hide" : "Show"} Players & Keepers
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <Tabs defaultValue="players">
          <TabsList>
            <TabsTrigger value="players">Players ({participants.length})</TabsTrigger>
            <TabsTrigger value="keepers">Keepers ({keepers.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="players">
            <ParticipantList participants={participants} />
          </TabsContent>
          <TabsContent value="keepers">
            <KeeperFeed keepers={keepers} />
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}
