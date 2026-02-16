"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ParticipantEntry } from "@/lib/round-feeds";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

function teamLabel(team: number): string {
  return team === 0 ? "Blue" : "Red";
}

function teamBadgeVariant(team: number): "default" | "destructive" {
  return team === 0 ? "default" : "destructive";
}

function statusBadge(entry: ParticipantEntry) {
  if (entry.claimedAmount !== null) {
    return <Badge variant="outline">Claimed</Badge>;
  }
  if (entry.revealed) {
    return <Badge variant="secondary">Revealed</Badge>;
  }
  return <Badge variant="secondary">Committed</Badge>;
}

export function ParticipantList({ participants }: { participants: ParticipantEntry[] }) {
  if (participants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participants</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No participants yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Participants ({participants.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-64">
          <div className="min-w-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.address}>
                    <TableCell className="font-mono text-xs">{truncateAddress(p.address)}</TableCell>
                    <TableCell>
                      <Badge variant={teamBadgeVariant(p.team)} className="text-xs">
                        {teamLabel(p.team)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{p.slotIndex}</TableCell>
                    <TableCell>{statusBadge(p)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-xs">
                      {p.claimedAmount !== null ? `${p.claimedAmount} wei` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
