import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DecisionsResponse, Line, NewDecision, Station } from "@shared/api";

const stations: Station[] = [
  "Chandanpur",
  "Porabazar",
  "Belmuri",
  "Dhaniakhali Halt",
  "Sibaichandi",
  "Hajigarh",
  "Gurap",
  "Jhapandanga",
  "Jaugram",
  "Nabagram",
  "Masagram",
  "Chanchai",
  "Palla Road",
  "Saktigarh",
];

const lines: Line[] = ["Up Main", "Down Main", "Reverse"];

export function TrackClosureReport() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"between" | "single">("between");
  const [line, setLine] = useState<Line>("Up Main");
  const [from, setFrom] = useState<Station>("Chandanpur");
  const [to, setTo] = useState<Station>("Saktigarh");
  const [at, setAt] = useState<Station>("Chandanpur");

  const mutation = useMutation({
    mutationFn: async () => {
      const text =
        mode === "between"
          ? `${line} closed between ${from} and ${to}`
          : `${line} closed at ${at}`;

      const payload: NewDecision = {
        message: "Track closure",
        category: "Maintenance",
        priority: "High",
        targets: mode === "between" ? [from, to] : [at],
        author: "Section Controller",
        meta: { trackClosure: text },
        effect: { lines: { [line]: "Blocked" } },
      } as any;

      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to report");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions"] }),
  });

  const { data } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const res = await fetch("/api/decisions");
      if (!res.ok) throw new Error("Failed to load decisions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const closures = (data?.decisions ?? []).filter((d) => d.meta?.trackClosure);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">Report Track Closure</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Mode</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as any)}
            className="grid grid-cols-2 gap-2"
          >
            <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
              <RadioGroupItem value="between" id="cl-between" />
              <span>Between</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
              <RadioGroupItem value="single" id="cl-single" />
              <span>At Station</span>
            </label>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>Line</Label>
          <Select value={line} onValueChange={(v) => setLine(v as Line)}>
            <SelectTrigger>
              <SelectValue placeholder="Select line" />
            </SelectTrigger>
            <SelectContent>
              {lines.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mode === "between" ? (
          <div className="space-y-2 sm:col-span-1">
            <Label>From</Label>
            <Select value={from} onValueChange={(v) => setFrom(v as Station)}>
              <SelectTrigger>
                <SelectValue placeholder="From station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2 sm:col-span-1">
            <Label>At</Label>
            <Select value={at} onValueChange={(v) => setAt(v as Station)}>
              <SelectTrigger>
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "between" && (
          <div className="space-y-2 sm:col-span-1">
            <Label>To</Label>
            <Select value={to} onValueChange={(v) => setTo(v as Station)}>
              <SelectTrigger>
                <SelectValue placeholder="To station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Reporting..." : "Report"}
          </Button>
        </div>
      </div>

      {closures.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Active closures</div>
          <ul className="space-y-2">
            {closures.map((d) => (
              <li key={d.id} className="text-sm">
                • {d.meta!.trackClosure}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
