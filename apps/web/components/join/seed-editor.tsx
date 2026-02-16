"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { SEED_BUDGET } from "@/lib/seed";
import type { JoinFlowReturn } from "@/hooks/use-join-flow";

type SeedEditorProps = Pick<
  JoinFlowReturn,
  | "draft"
  | "liveCells"
  | "budgetProgress"
  | "editorDisabled"
  | "seedPresets"
  | "applyPreset"
  | "handleSeedCellToggle"
  | "transformSeed"
  | "translateSeed"
  | "updateDraft"
>;

export function SeedEditor({
  draft,
  liveCells,
  budgetProgress,
  editorDisabled,
  seedPresets,
  applyPreset,
  handleSeedCellToggle,
  transformSeed,
  translateSeed,
  updateDraft,
}: SeedEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground tabular-nums text-xs">
          {liveCells}/{SEED_BUDGET} cells
        </span>
        <Progress value={budgetProgress} className="h-2 w-24" />
      </div>

      <Tabs defaultValue="presets">
        <TabsList className="w-full">
          <TabsTrigger value="presets" className="flex-1">Presets</TabsTrigger>
          <TabsTrigger value="draw" className="flex-1">Draw</TabsTrigger>
          <TabsTrigger value="transform" className="flex-1">Transform</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="pt-2">
          <div className="flex flex-wrap gap-2">
            {seedPresets.map((preset) => (
              <Button key={preset.id} type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => applyPreset(preset.id)}>
                {preset.name}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => updateDraft("seedBits", 0n)}>
              Clear
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="draw" className="pt-2">
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 64 }, (_, index) => {
              const x = index % 8;
              const y = Math.floor(index / 8);
              const alive = (draft.seedBits >> BigInt(y * 8 + x)) & 1n;

              return (
                <Toggle
                  key={`${x}-${y}`}
                  variant="outline"
                  size="sm"
                  disabled={editorDisabled}
                  pressed={alive === 1n}
                  aria-label={`seed-${x}-${y}`}
                  onPressedChange={() => handleSeedCellToggle(x, y)}
                  className="h-7 min-w-7 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <span className="sr-only">{alive ? "alive" : "dead"}</span>
                </Toggle>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="transform" className="pt-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => transformSeed("rotate-90")}>
              Rotate 90
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => transformSeed("rotate-180")}>
              Rotate 180
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => transformSeed("rotate-270")}>
              Rotate 270
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => transformSeed("mirror-x")}>
              Mirror X
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => transformSeed("mirror-y")}>
              Mirror Y
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => translateSeed(0, -1)}>
              Up
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => translateSeed(0, 1)}>
              Down
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => translateSeed(-1, 0)}>
              Left
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={editorDisabled} onClick={() => translateSeed(1, 0)}>
              Right
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
