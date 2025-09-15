import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { DecisionsResponse, Line, Priority, Station } from "@shared/api";
import { cn } from "@/lib/utils";

type Role = "assistant" | "user";
interface ChatMsg {
  id: string;
  role: Role;
  text: string;
  chips?: { label: string; value: string }[];
}

interface Alternative {
  key: string;
  title: string;
  directive: "pass" | "halt" | "stable";
  passThroughLine?: Line;
  loopStation?: Station;
  loopId?: number;
  explanation: string;
}

const allLines: Line[] = ["Up Main", "Down Main", "Reverse"];
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
const loopStations: Station[] = ["Chandanpur", "Masagram", "Gurap", "Saktigarh"];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState<{ priority?: Priority; destination?: Station; currentPosition?: string }>({});
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: decisionsData } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const res = await fetch("/api/decisions");
      if (!res.ok) throw new Error("Failed to load decisions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const live = useMemo(() => {
    const loads: Record<Line, number> = { "Up Main": 0, "Down Main": 0, Reverse: 0 } as any;
    const blocked: Partial<Record<Line, boolean>> = {};
    const now = Date.now();
    const active = (decisionsData?.decisions ?? []).filter((d) => {
      const eff = new Date(d.effectiveAt).getTime();
      const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : Infinity;
      return eff <= now && now < exp;
    });
    for (const d of active) {
      if (d.meta?.passThroughLine) loads[d.meta.passThroughLine] += 1;
      if (d.effect?.lines) {
        for (const [ln, st] of Object.entries(d.effect.lines)) {
          if (st === "Blocked") blocked[ln as Line] = true;
          if (st === "Occupied" || st === "Maintenance") loads[ln as Line] = Math.max(loads[ln as Line], 1);
        }
      }
      const tc = d.meta?.trackClosure?.toLowerCase() || "";
      if (tc.includes("up") && tc.includes("main")) blocked["Up Main"] = true;
      if (tc.includes("down") && tc.includes("main")) blocked["Down Main"] = true;
      if (tc.includes("reverse")) blocked["Reverse"] = true;
    }
    return { loads, blocked };
  }, [decisionsData]);

  useEffect(() => {
    if (!open) return;
    const summary = `Live occupancy — Up: ${live.loads["Up Main"] ?? 0}, Down: ${live.loads["Down Main"] ?? 0}, Reverse: ${live.loads["Reverse"] ?? 0}. Blocked: ${allLines
      .filter((l) => live.blocked[l])
      .join(", ") || "None"}.`;
    const intro: ChatMsg = {
      id: "intro",
      role: "assistant",
      text: `${summary} What is the train priority?`,
      chips: [
        { label: "Low", value: "Low" },
        { label: "Normal", value: "Normal" },
        { label: "High", value: "High" },
        { label: "Critical", value: "Critical" },
      ],
    };
    setMessages([intro]);
    setAlternatives([]);
    setFormData({});
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const parseAndUpdate = (text: string) => {
    const next: Partial<typeof formData> = {};
    const t = text.toLowerCase();
    const prioMap: Record<string, Priority> = { low: "Low", normal: "Normal", medium: "Normal", high: "High", critical: "Critical" } as any;
    for (const k of Object.keys(prioMap)) {
      if (t.includes(k)) next.priority = prioMap[k];
    }
    const hit = stations.find((s) => t.includes(s.toLowerCase()));
    if (hit) next.destination = hit;
    const posMatch = text.match(/(at|near|passing)\s+([A-Za-z\s]+)$/i);
    if (posMatch) next.currentPosition = posMatch[2].trim();
    if (Object.keys(next).length) setFormData((s) => ({ ...s, ...next }));
    return next;
  };

  const getBestLine = () => {
    const avail = allLines.filter((l) => !live.blocked[l]);
    if (!avail.length) return undefined;
    return avail.sort((a, b) => (live.loads[a] || 0) - (live.loads[b] || 0))[0];
  };

  const proposeStrategies = () => {
    if (!formData.priority || !formData.destination || !formData.currentPosition) return;
    const best = getBestLine();
    const loopAt = loopStations.includes(formData.destination) ? formData.destination : loopStations[0];

    const list: Alternative[] = [];

    if (best) {
      list.push({
        key: `pass-${best}`,
        title: `Pass-through via ${best}`,
        directive: "pass",
        passThroughLine: best,
        explanation: `Lowest live load on ${best}. Suitable for ${formData.priority} priority.`,
      });
    }

    list.push({
      key: `cross-${loopAt}`,
      title: `Crossing at ${loopAt}`,
      directive: "stable",
      loopStation: loopAt,
      loopId: 1,
      explanation: `Hold at ${loopAt} loop to allow opposing movement to pass safely, then proceed.`,
    });

    list.push({
      key: `precedence-${best || "line"}`,
      title: `Precedence to higher-priority movement`,
      directive: best ? "pass" : "stable",
      passThroughLine: best,
      loopStation: !best ? loopAt : undefined,
      loopId: !best ? 1 : undefined,
      explanation: formData.priority === "Low" || formData.priority === "Normal"
        ? `Yield by waiting at ${loopAt} to clear main line, then proceed via ${best || "available line"}.`
        : `Proceed via ${best || "available line"} and instruct lower-priority movements to hold.`,
    });

    list.push({
      key: `overtake-${loopAt}`,
      title: `Overtake at ${loopAt}`,
      directive: "stable",
      loopStation: loopAt,
      loopId: 1,
      explanation: `Stage at ${loopAt} to allow faster consist to overtake, reducing following delays.`,
    });

    setAlternatives(list);

    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Based on current section status and your inputs (priority: ${formData.priority}, destination: ${formData.destination}, position: ${formData.currentPosition}), here are recommended strategies:`,
      },
    ]);
  };

  const onSend = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: v }]);
    const extracted = parseAndUpdate(v);
    const merged = { ...formData, ...extracted };

    if (!merged.priority) {
      setMessages((m) => [
        ...m,
        {
          id: uuid(),
          role: "assistant",
          text: "Got it. What's the train priority?",
          chips: [
            { label: "Low", value: "Low" },
            { label: "Normal", value: "Normal" },
            { label: "High", value: "High" },
            { label: "Critical", value: "Critical" },
          ],
        },
      ]);
      return;
    }
    if (!merged.destination) {
      setMessages((m) => [
        ...m,
        {
          id: uuid(),
          role: "assistant",
          text: "Destination station?",
          chips: stations.slice(0, 6).map((s) => ({ label: s, value: s })),
        },
      ]);
      return;
    }
    if (!merged.currentPosition) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Current position (e.g., 'Passing Belmuri' or 'At Masagram')?",
        },
      ]);
      return;
    }
    proposeStrategies();
  };

  const applyAlternative = (alt: Alternative) => {
    const detail: any = {
      priority: formData.priority,
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

  const onChip = (value: string) => {
    onSend(value);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-2xl p-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Bot className="h-6 w-6 text-primary" /> Rail AI Assistant
              </DialogTitle>
              <DialogDescription>Scenario planner and what-if simulation for crossing, precedence, and overtake.</DialogDescription>
            </DialogHeader>

            <div ref={scrollRef} className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={cn("rounded-lg border p-4", m.role === "assistant" ? "bg-card" : "bg-transparent text-muted-foreground")}>
                  <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                  {m.chips && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.chips.map((c, i) => (
                        <Button key={`${m.id}-${i}`} size="sm" variant="outline" onClick={() => onChip(c.value)}>
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {alternatives.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Suggested strategies</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const r = await fetch("/api/ai/plan", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ live, inputs: formData }),
                          });
                          const data = await r.json();
                          if (Array.isArray(data?.alternatives) && data.alternatives.length) {
                            setAlternatives(data.alternatives);
                            setMessages((m) => [
                              ...m,
                              { id: crypto.randomUUID(), role: "assistant", text: "Here is a Gemini-assisted plan with detailed rationale." },
                            ]);
                          } else {
                            setMessages((m) => [
                              ...m,
                              { id: crypto.randomUUID(), role: "assistant", text: "Gemini could not produce a plan for the current inputs." },
                            ]);
                          }
                        } catch (e) {
                          setMessages((m) => [
                            ...m,
                            { id: crypto.randomUUID(), role: "assistant", text: "AI request failed. Please try again." },
                          ]);
                        }
                      }}
                    >
                      Ask Gemini Plan
                    </Button>
                  </div>
                  {alternatives.map((alt) => (
                    <div key={alt.key} className="rounded-md border p-4">
                      <div className="text-sm font-medium">{alt.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{alt.explanation}</div>
                      <div className="mt-2">
                        <Button size="sm" onClick={() => applyAlternative(alt)}>Apply to Decision</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = input;
                  setInput("");
                  onSend(v);
                }}
                className="flex items-center gap-2"
              >
                <Input
                  placeholder="Type here... (e.g., High priority to Saktigarh, passing Belmuri)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button type="submit" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
        <Wand2 className="h-5 w-5" />
        <span className="sr-only">Open Rail AI Assistant</span>
      </Button>
    </>
  );
}

export default AIAssistant;
