import { useMemo, useState } from "react";
import { Bot, LineChart, PlayCircle, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { DecisionsResponse, Line, Priority, Station } from "@shared/api";
import { cn } from "@/lib/utils";

interface ScenarioInputs {
  priority: Priority;
  blocked: Partial<Record<Line, boolean>>;
  extraLoad: Partial<Record<Line, number>>; // simulated extra trains on line
  preferLoopAt?: Station;
}

interface Alternative {
  key: string;
  title: string;
  directive: "pass" | "halt" | "stable";
  passThroughLine?: Line;
  loopStation?: Station;
  loopId?: number;
  expectedDelay: number; // minutes
  risk: number; // 0-100
  explanation: string;
}

const allLines: Line[] = ["Up Main", "Down Main", "Reverse"];
const loopStations: Station[] = ["Chandanpur", "Masagram", "Gurap", "Saktigarh"];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<ScenarioInputs>({
    priority: "Normal",
    blocked: {},
    extraLoad: {},
    preferLoopAt: undefined,
  });
  const [results, setResults] = useState<{ alternatives: Alternative[]; recommendation?: Alternative }>();

  const { data: decisionsData } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const res = await fetch("/api/decisions");
      if (!res.ok) throw new Error("Failed to load decisions");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const loadsFromLive = useMemo(() => {
    const loads: Record<Line, number> = {
      "Up Main": 0,
      "Down Main": 0,
      Reverse: 0,
    } as any;
    const blocked: Partial<Record<Line, boolean>> = {};
    const active = (decisionsData?.decisions ?? [])
      .filter((d) => {
        const now = Date.now();
        const eff = new Date(d.effectiveAt).getTime();
        const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : Infinity;
        return eff <= now && now < exp;
      })
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    for (const d of active) {
      if (d.meta?.passThroughLine) loads[d.meta.passThroughLine] += 1;
      if (d.effect?.lines) {
        for (const [ln, st] of Object.entries(d.effect.lines)) {
          if (st === "Blocked") blocked[ln as Line] = true;
          if (st === "Occupied" || st === "Maintenance")
            loads[ln as Line] = Math.max(loads[ln as Line], 1);
        }
      }
      const tc = d.meta?.trackClosure?.toLowerCase() || "";
      if (tc) {
        if (tc.includes("up") && tc.includes("main")) blocked["Up Main"] = true;
        if (tc.includes("down") && tc.includes("main")) blocked["Down Main"] = true;
        if (tc.includes("reverse")) blocked["Reverse"] = true;
      }
    }
    return { loads, blocked };
  }, [decisionsData]);

  const runAnalysis = () => {
    const baseLoads = { ...loadsFromLive.loads } as Record<Line, number>;
    const blocked = { ...loadsFromLive.blocked, ...inputs.blocked } as Record<Line, boolean>;
    for (const ln of allLines) baseLoads[ln] = (baseLoads[ln] || 0) + (inputs.extraLoad[ln] || 0);

    const candidates: Alternative[] = [];

    // Pass-through options
    for (const ln of allLines) {
      if (blocked[ln]) continue;
      const load = baseLoads[ln] || 0;
      const delay = Math.max(0, load - 1) * 5; // 5 min per train queued beyond 1
      const risk = Math.min(100, load * 20 + (inputs.priorityWeight === undefined ? 0 : 0));
      candidates.push({
        key: `pass-${ln}`,
        title: `Pass via ${ln} Line`,
        directive: "pass",
        passThroughLine: ln,
        expectedDelay: delay,
        risk,
        explanation: `Current load on ${ln} is ${load}. Estimated delay ${delay} min. No blockages reported in scenario.`,
      });
    }

    // Stable option (loop)
    const loopAt = inputs.preferLoopAt || loopStations[0];
    candidates.push({
      key: `stable-${loopAt}`,
      title: `Stable at ${loopAt}`,
      directive: "stable",
      loopStation: loopAt,
      loopId: 1,
      expectedDelay: 10,
      risk: inputs.priority === "Low" ? 15 : inputs.priority === "Normal" ? 25 : 40,
      explanation: `Use loop at ${loopAt} to deconflict main lines. Suitable when main lines are saturated or blocked.`,
    });

    // Halt option
    candidates.push({
      key: `halt`,
      title: "Halt at target station",
      directive: "halt",
      expectedDelay: inputs.priority === "High" || inputs.priority === "Critical" ? 20 : 12,
      risk: inputs.priority === "High" || inputs.priority === "Critical" ? 65 : 45,
      explanation: `Halt reduces immediate risk but increases delay. Consider only if all lines are constrained.`,
    });

    // Score and pick recommendation
    const score = (a: Alternative) => {
      const prio = inputs.priority;
      const delayW = prio === "Critical" ? 0.7 : prio === "High" ? 0.6 : prio === "Normal" ? 0.5 : 0.4;
      const riskW = 1 - delayW;
      return -(a.expectedDelay * delayW + a.risk * riskW);
    };

    const sorted = candidates.sort((a, b) => score(b) - score(a));
    const recommendation = sorted[0];
    setResults({ alternatives: sorted, recommendation });
  };

  const applyAlternative = (alt: Alternative) => {
    const detail: any = {
      priority: inputs.priority,
      meta: {
        directive: alt.directive,
        passThroughLine: alt.passThroughLine,
        loopStation: alt.loopStation,
        loopId: alt.loopId,
      },
    };
    const evt = new CustomEvent("ai-recommendation-apply", { detail });
    window.dispatchEvent(evt);
    setOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Rail AI Assistant
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            <div className="rounded-lg border p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={inputs.priority}
                    onValueChange={(v) => setInputs((s) => ({ ...s, priority: v as Priority }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Low", "Normal", "High", "Critical"] as Priority[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prefer Loop At</Label>
                  <Select
                    value={inputs.preferLoopAt as any}
                    onValueChange={(v) => setInputs((s) => ({ ...s, preferLoopAt: v as Station }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {loopStations.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4" />
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  {allLines.map((ln) => (
                    <div key={ln} className="flex items-center justify-between rounded-md border p-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Block {ln}</div>
                        <div className="text-xs text-muted-foreground">Simulate track closure</div>
                      </div>
                      <Switch
                        checked={!!inputs.blocked[ln]}
                        onCheckedChange={(c) =>
                          setInputs((s) => ({
                            ...s,
                            blocked: { ...s.blocked, [ln]: c || undefined },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <LineChart className="h-4 w-4" /> Simulate mainline load
                  </div>
                  {allLines.map((ln) => (
                    <div key={ln} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{ln}</span>
                        <span>+{inputs.extraLoad[ln] || 0} trains</span>
                      </div>
                      <Slider
                        min={0}
                        max={3}
                        step={1}
                        value={[inputs.extraLoad[ln] || 0]}
                        onValueChange={(v) =>
                          setInputs((s) => ({
                            ...s,
                            extraLoad: { ...s.extraLoad, [ln]: v[0] },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <Button className="w-full" onClick={runAnalysis}>
                  <PlayCircle className="h-4 w-4 mr-2" /> Run Scenario Analysis
                </Button>
              </div>
            </div>

            {results && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 bg-secondary/30">
                  <div className="text-sm text-muted-foreground">Recommendation</div>
                  <div className="mt-1 font-semibold">{results.recommendation?.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {results.recommendation?.explanation}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => results.recommendation && applyAlternative(results.recommendation)}>
                      Apply to Decision
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Alternatives</div>
                  <div className="grid gap-2">
                    {results.alternatives.map((alt) => (
                      <div key={alt.key} className={cn("rounded-md border p-3", alt.key === results.recommendation?.key ? "border-primary" : undefined)}>
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{alt.title}</div>
                          <div className="text-xs text-muted-foreground">Delay ~ {alt.expectedDelay}m · Risk {alt.risk}%</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{alt.explanation}</div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant={alt.key === results.recommendation?.key ? "default" : "outline"} onClick={() => applyAlternative(alt)}>
                            Use This
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!results && (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Configure a what-if scenario and run analysis to get recommendations. The assistant compares pass-through, halt, and stable strategies across lines with live section load and your simulated constraints.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Button
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Wand2 className="h-5 w-5" />
        <span className="sr-only">Open Rail AI Assistant</span>
      </Button>
    </>
  );
}

export default AIAssistant;
