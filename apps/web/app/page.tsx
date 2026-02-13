import { BoardCanvas } from "@/components/board-canvas";
import { RoundLivePanel } from "@/components/round-live-panel";
import { RoundWalletPanel } from "@/components/round-wallet-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

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

      <BoardCanvas />

      <div className="grid gap-6 lg:grid-cols-2">
        <RoundLivePanel />
        <RoundWalletPanel />
      </div>
    </main>
  );
}
