import { summarizeBoard } from "../lib/board-summary";
import { RoundLivePanel } from "@/components/round-live-panel";
import { RoundWalletPanel } from "@/components/round-wallet-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const previewSummary = summarizeBoard({
  width: 8,
  height: 8,
  blueRows: [0b00110000n, 0b00110000n, 0n, 0n, 0n, 0n, 0n, 0n],
  redRows: [0n, 0n, 0n, 0n, 0n, 0n, 0b00001100n, 0b00001100n],
});

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Shape L2
          </Badge>
          <CardTitle className="text-3xl md:text-4xl">Conway Arena</CardTitle>
          <p className="text-muted-foreground">
            Spectator-first multiplayer Conway&apos;s Game of Life with onchain commit/reveal rounds.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RoundLivePanel />
        <RoundWalletPanel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview Board Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Blue cells: {previewSummary.blue}</p>
          <p>Red cells: {previewSummary.red}</p>
          <p>Total live cells: {previewSummary.total}</p>
          <Separator />
          <p className="text-muted-foreground">Local visual scaffold while full in-browser simulation playback is built.</p>
        </CardContent>
      </Card>
    </main>
  );
}
