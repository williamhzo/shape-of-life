"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TEAM_BLUE, TEAM_RED } from "@/lib/seed";

export function TeamSelect({
  team,
  disabled,
  onTeamSelect,
}: {
  team: number;
  disabled: boolean;
  onTeamSelect: (team: number) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(team)}
      onValueChange={(value) => {
        if (value) onTeamSelect(Number(value));
      }}
      disabled={disabled}
    >
      <ToggleGroupItem value={String(TEAM_BLUE)} className="data-[state=on]:bg-blue-600 data-[state=on]:text-white">
        Blue
      </ToggleGroupItem>
      <ToggleGroupItem value={String(TEAM_RED)} className="data-[state=on]:bg-red-600 data-[state=on]:text-white">
        Red
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
