"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SLOT_COUNT, TEAM_BLUE, isSlotIndexInTeamTerritory, slotIndexToGrid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import type { ParticipantEntry } from "@/lib/round-feeds";

export function SlotPicker({
  team,
  slotIndex,
  disabled,
  participants,
  onSlotSelect,
}: {
  team: number;
  slotIndex: number;
  disabled: boolean;
  participants: ParticipantEntry[];
  onSlotSelect: (index: number) => void;
}) {
  const occupiedSlots = new Set(participants.map((p) => p.slotIndex));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const inTerritory = isSlotIndexInTeamTerritory(team, i);
          const occupied = occupiedSlots.has(i);
          const selected = i === slotIndex;
          const grid = slotIndexToGrid(i);
          const isBlueTerritory = isSlotIndexInTeamTerritory(TEAM_BLUE, i);

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={selected ? "default" : "outline"}
                  disabled={!inTerritory || occupied || disabled}
                  className={cn(
                    "h-8 px-0 text-xs",
                    !selected && inTerritory && !occupied && (isBlueTerritory ? "border-blue-800/30" : "border-red-800/30"),
                    occupied && "opacity-40",
                  )}
                  onClick={() => onSlotSelect(i)}
                >
                  {i}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Slot {i} at ({grid.tileX}, {grid.tileY}){occupied ? " (taken)" : ""}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        Slot {slotIndex} at ({slotIndexToGrid(slotIndex).tileX}, {slotIndexToGrid(slotIndex).tileY})
      </p>
    </div>
  );
}
