import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { DecisionsResponse, Line, Status } from "@shared/api";

const diskColor: Record<string, string> = {
  Clear: "bg-emerald-500",
  Busy: "bg-amber-500",
  Congested: "bg-red-500",
  Blocked: "bg-red-600",
};
const barColor: Record<string, string> = {
  Clear: "bg-emerald-500/70",
  Busy: "bg-amber-400/70",
  Congested: "bg-red-500/70",
  Blocked: "bg-red-600/70",
};

interface SectionStatusProps {
  className?: string;
}

export function SectionStatus({ className }: SectionStatusProps) {
  const { data } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/decisions");
        if (!res.ok) return { decisions: [] };
        return res.json();
      } catch (e) {
        // network error — return empty dataset to avoid crashing UI
        return { decisions: [] };
      }
    },
    refetchInterval: 3000,
  });

  const active = (data?.decisions ?? [])
    .filter((d) => {
      const now = Date.now();
      const eff = new Date(d.effectiveAt).getTime();
      const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : Infinity;
      return eff <= now && now < exp;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const loads: Record<Line, number> = { "Up Main": 0, "Down Main": 0, Reverse: 0 };
  const blocked: Partial<Record<Line, boolean>> = {};

  for (const d of active) {
    // Count traffic by pass-through line
    if (d.meta?.passThroughLine) {
      loads[d.meta.passThroughLine] += 1;
    }
    // Respect explicit effects as overrides
    if (d.effect?.lines) {
      for (const [ln, st] of Object.entries(d.effect.lines)) {
        if (st === "Blocked") blocked[ln as Line] = true;
        if (st === "Occupied") loads[ln as Line] = Math.max(loads[ln as Line], 1);
        if (st === "Maintenance") loads[ln as Line] = Math.max(loads[ln as Line], 1);
      }
    }
    // Parse track closures
    const tc = d.meta?.trackClosure?.toLowerCase() || "";
    if (tc) {
      if (tc.includes("up") && tc.includes("main")) blocked["Up Main"] = true;
      if (tc.includes("down") && tc.includes("main")) blocked["Down Main"] = true;
      if (tc.includes("reverse")) blocked["Reverse"] = true;
    }
  }

  const level = (ln: Line): { label: string; disk: string; bar: string } => {
    if (blocked[ln]) return { label: "Blocked", disk: diskColor.Blocked, bar: barColor.Blocked };
    const n = loads[ln];
    if (n === 0) return { label: "Clear", disk: diskColor.Clear, bar: barColor.Clear };
    if (n <= 2) return { label: "Busy", disk: diskColor.Busy, bar: barColor.Busy };
    return { label: "Congested", disk: diskColor.Congested, bar: barColor.Congested };
  };

  const up = level("Up Main");
  const down = level("Down Main");
  const rev = level("Reverse");

  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">Eastern Railway • Section</h3>
        <span className="text-xs text-muted-foreground">Chandanpur ↔ Shaktigarh</span>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">Up Main Line</span>
            <div className={cn("relative h-1.5 w-full rounded-full", up.bar)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">Down Main Line</span>
            <div className={cn("relative h-1.5 w-full rounded-full", down.bar)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">Reverse Line</span>
            <div className={cn("relative h-1.5 w-full rounded-full", rev.bar)} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Chandanpur</span>
          <span>Shaktigarh</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border p-3 bg-background">
          <div className="font-medium text-muted-foreground">Up Main Line</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("inline-flex h-2 w-2 rounded-full", up.disk)} />
            <span>{up.label}</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 bg-background">
          <div className="font-medium text-muted-foreground">Down Main Line</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("inline-flex h-2 w-2 rounded-full", down.disk)} />
            <span>{down.label}</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 bg-background">
          <div className="font-medium text-muted-foreground">Reverse Line</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("inline-flex h-2 w-2 rounded-full", rev.disk)} />
            <span>{rev.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
