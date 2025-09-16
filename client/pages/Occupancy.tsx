import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { DecisionsResponse, Decision, Line, Status, Station } from "@shared/api";
import { useMemo, useState } from "react";

const statusColor: Record<Status, string> = {
  Free: "bg-emerald-500",
  Occupied: "bg-amber-500",
  Blocked: "bg-red-600",
  Maintenance: "bg-blue-500",
};

const STATIONS: { name: Station | string; code?: string; loops?: number }[] = [
  { name: "Chandanpur", code: "CDAE", loops: 3 },
  { name: "Porabazar" },
  { name: "Belmuri" },
  { name: "Dhaniakhali Halt" },
  { name: "Sibaichandi" },
  { name: "Hajigarh" },
  { name: "Gurap", loops: 1 },
  { name: "Jhapandanga" },
  { name: "Jaugram" },
  { name: "Nabagram" },
  { name: "Masagram", loops: 2 },
  { name: "Chanchai" },
  { name: "Palla Road" },
  { name: "Saktigarh", code: "SKG" },
];

function isActive(decision: Decision) {
  const now = Date.now();
  const eff = new Date(decision.effectiveAt).getTime();
  const exp = decision.expiresAt ? new Date(decision.expiresAt).getTime() : Infinity;
  return eff <= now && now < exp;
}

export default function Occupancy() {
  const [q, setQ] = useState("");
  const { data } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/decisions");
        if (!res.ok) return { decisions: [] };
        return res.json();
      } catch (e) {
        return { decisions: [] };
      }
    },
    refetchInterval: 5000,
  });

  const { stations, lines } = useMemo(() => {
    // Defaults: everything Free
    const baseLine: Record<Line, Status> = { "Up Main": "Free", "Down Main": "Free", Reverse: "Free" };
    const stationMap = new Map<string, { status: Status; updatedAt: string; loops?: number; lineStatus?: Partial<Record<Line, Status>> }>();
    const loopMap = new Map<string, { [loopId: number]: { train: string; updatedAt: string } }>();
    STATIONS.forEach((s) => stationMap.set(String(s.name), { status: "Free", updatedAt: new Date(0).toISOString(), loops: s.loops, lineStatus: {} }));

    const active = (data?.decisions ?? [])
      .filter(isActive)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const stationNames = STATIONS.map((s) => String(s.name).toLowerCase());
    const matchStationFromText = (text?: string) => {
      if (!text) return undefined;
      const t = text.toLowerCase();
      return stationNames.find((n) => t.includes(n));
    };

    for (const d of active) {
      if (d.effect?.stationStatus) {
        for (const t of d.targets) {
          const key = String(t);
          const curr = stationMap.get(key);
          if (curr) {
            stationMap.set(key, { ...curr, status: d.effect.stationStatus, updatedAt: d.createdAt });
          }
        }
      }
      if (d.effect?.lines) {
        for (const [ln, st] of Object.entries(d.effect.lines)) {
          baseLine[ln as Line] = st as Status;
        }
      }
      if (d.effect?.loopAssignments) {
        for (const la of d.effect.loopAssignments) {
          const key = String(la.station);
          if (!loopMap.has(key)) loopMap.set(key, {});
          loopMap.get(key)![la.loopId] = { train: la.train, updatedAt: d.createdAt };
        }
      }
      // Map pass-through line + current position to station line occupancy
      const matched = matchStationFromText(d.meta?.currentPosition);
      if (matched && d.meta?.passThroughLine) {
        const key = STATIONS.find((s) => String(s.name).toLowerCase() === matched)!.name as string;
        const curr = stationMap.get(key);
        if (curr) {
          const ls = { ...(curr.lineStatus || {}) };
          ls[d.meta.passThroughLine] = "Occupied";
          stationMap.set(key, { ...curr, lineStatus: ls, updatedAt: d.createdAt });
        }
      }
    }

    const stations = Array.from(stationMap.entries()).map(([name, v]) => {
      const loops = v.loops
        ? Array.from({ length: v.loops }).map((_, i) => {
            const assn = loopMap.get(name)?.[i + 1];
            return {
              id: i + 1,
              status: assn ? ("Occupied" as Status) : v.status,
              train: assn?.train,
              updatedAt: assn?.updatedAt ?? v.updatedAt,
            };
          })
        : undefined;
      return { name, status: v.status, lastUpdated: v.updatedAt, loops, lineStatus: v.lineStatus };
    });
    return { stations, lines: baseLine };
  }, [data]);

  const filtered = useMemo(() => stations.filter((s) => `${s.name}`.toLowerCase().includes(q.trim().toLowerCase())), [stations, q]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-background to-primary/5">
      <div className="container py-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Station & Line Occupancy — Chandanpur to Saktigarh</h1>
          <p className="text-sm text-muted-foreground">Defaults to Free; changes according to active decisions.</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(lines) as Line[]).map((ln) => (
              <Badge key={ln} variant="outline" className="flex items-center gap-2">
                <span className={cn("inline-flex h-2 w-2 rounded-full", statusColor[lines[ln]])} />
                {ln}: {lines[ln]}
              </Badge>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Input placeholder="Search stations" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className={cn("h-2 w-2 rounded-full", statusColor.Free)} />Free</span>
            <span className="inline-flex items-center gap-1"><i className={cn("h-2 w-2 rounded-full", statusColor.Occupied)} />Occupied</span>
            <span className="inline-flex items-center gap-1"><i className={cn("h-2 w-2 rounded-full", statusColor.Maintenance)} />Maintenance</span>
            <span className="inline-flex items-center gap-1"><i className={cn("h-2 w-2 rounded-full", statusColor.Blocked)} />Blocked</span>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((s) => (
              <div key={s.name} className="rounded-lg border p-4 bg-background">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium leading-tight">{s.name}</div>
                    {s.name === "Chandanpur" && <div className="text-xs text-muted-foreground">(CDAE)</div>}
                    {s.name === "Saktigarh" && <div className="text-xs text-muted-foreground">(SKG)</div>}
                  </div>
                  <Badge variant="outline" className="flex items-center gap-2">
                    <span className={cn("inline-flex h-2 w-2 rounded-full", statusColor[s.status as Status])} />
                    {s.status}
                  </Badge>
                </div>

                {Array.isArray(s.loops) && s.loops.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground">Loops</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s.loops.map((l: any) => (
                        <Badge key={l.id} variant="secondary" className="flex items-center gap-2">
                          <span className={cn("inline-flex h-2 w-2 rounded-full", statusColor[l.status as Status])} />
                          Loop {l.id}: {l.status}
                          {l.train ? <span className="text-[10px] text-muted-foreground">({l.train})</span> : null}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {s.lineStatus && Object.keys(s.lineStatus).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground">Lines</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(Object.keys(s.lineStatus) as any).map((ln: any) => (
                        <Badge key={ln} variant="outline" className="flex items-center gap-2">
                          <span className={cn("inline-flex h-2 w-2 rounded-full", statusColor[(s.lineStatus as any)[ln]])} />
                          {ln}: {(s.lineStatus as any)[ln]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">Last change {s.lastUpdated !== new Date(0).toISOString() ? new Date(s.lastUpdated).toLocaleString() : "—"}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
