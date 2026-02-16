"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { KeeperEntry } from "@/lib/round-feeds";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

export function KeeperFeed({ keepers }: { keepers: KeeperEntry[] }) {
  if (keepers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keepers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No keeper activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalGens = keepers.reduce((sum, k) => sum + k.gensAdvanced, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Keepers ({keepers.length})</CardTitle>
        <Badge variant="secondary">{totalGens} gens</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Steps</TableHead>
                <TableHead className="text-right">Gens</TableHead>
                <TableHead className="text-right">Reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keepers.map((k, i) => (
                <TableRow key={k.address}>
                  <TableCell className="font-mono tabular-nums">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{truncateAddress(k.address)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{k.stepCount}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{k.gensAdvanced}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{k.totalReward} wei</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
