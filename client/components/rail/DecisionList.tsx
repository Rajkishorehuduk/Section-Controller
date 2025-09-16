import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Decision, DecisionsResponse } from "@shared/api";
import { formatDistanceToNow } from "date-fns";

function lineText(d: Decision) {
  const la = d.effect?.loopAssignments?.[0];
  const train = d.meta?.consistNo || la?.train || "—";
  if (d.meta?.trackClosure) {
    return `Track Closure: ${d.meta.trackClosure}`;
  }
  if (la?.station && la.loopId) {
    const st = `${la.station.charAt(0).toUpperCase()}${la.station.slice(1)}`;
    return `${train} to be looped at ${st} Loop ${la.loopId}`;
  }
  if (d.meta?.passThroughLine) {
    return `${train} to pass via ${d.meta.passThroughLine} Line`;
  }
  return d.message || `${train}`;
}

export function DecisionList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<DecisionsResponse>({
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

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/decisions/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to withdraw");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions"] }),
  });

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground mb-3">Decision Feed</h3>
      <div className="space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {!isLoading && (!data || data.decisions.length === 0) && (
          <div className="text-sm text-muted-foreground">No decisions yet.</div>
        )}
        {data?.decisions.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 bg-background">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="shrink-0">{d.priority}</Badge>
              <span className="text-sm font-medium truncate">{lineText(d)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Withdraw this decision?")) withdraw.mutate(d.id);
                }}
              >
                Withdraw
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
