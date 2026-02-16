import { RoundDashboard } from "@/components/round-dashboard";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Conway Arena{" "}
          <Badge variant="secondary" className="align-middle text-sm">
            Shape L2
          </Badge>
        </h1>
        <p className="text-muted-foreground">
          Multiplayer Conway&apos;s Game of Life with onchain commit/reveal rounds.
        </p>
      </div>

      <RoundDashboard />
    </main>
  );
}
