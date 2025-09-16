import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  Category,
  NewDecision,
  Priority,
  Station,
  Line,
  DecisionsResponse,
} from "@shared/api";
import { toast } from "sonner";

const categories: Category[] = [
  "Movement",
  "Maintenance",
  "Safety",
  "Power",
  "Emergency",
];
const priorities: Priority[] = ["Low", "Normal", "High", "Critical"];
const allStations: Station[] = [
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

export function DecisionForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState<NewDecision>({
    message: "",
    category: "Movement",
    priority: "Normal",
    targets: [...allStations],
    author: "Section Controller",
    meta: {
      passThroughLine: undefined,
      loopStation: undefined,
      directive: "pass",
    },
  });

  const loopsByStation: Record<string, number> = useMemo(
    () => ({ Chandanpur: 3, Gurap: 1, Masagram: 2 }),
    [],
  );

  const { data: decisionsData } = useQuery<DecisionsResponse>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const res = await fetch("/api/decisions");
      if (!res.ok) throw new Error("Failed to load decisions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: async (payload: NewDecision) => {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create decision");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Decision issued to stations");
      qc.invalidateQueries({ queryKey: ["decisions"] });
      setForm((f) => ({ ...f, message: "" }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const detail: any = (ce.detail as any) || {};
      setForm((f) => ({
        ...f,
        priority: (detail.priority as any) ?? f.priority,
        meta: { ...f.meta, ...(detail.meta || {}) },
      }));
      toast.info("Applied AI recommendation");
    };
    window.addEventListener(
      "ai-recommendation-apply",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "ai-recommendation-apply",
        handler as EventListener,
      );
    };
  }, []);

  async function suggestWithAI() {
    try {
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
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
          if (tc.includes("up") && tc.includes("main"))
            blocked["Up Main"] = true;
          if (tc.includes("down") && tc.includes("main"))
            blocked["Down Main"] = true;
          if (tc.includes("reverse")) blocked["Reverse"] = true;
        }
      }

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live: { loads, blocked },
          inputs: {
            priority: form.priority,
            destination: (form as any).meta?.consistDestination,
            currentPosition: (form as any).meta?.currentPosition,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "AI request failed");
      }
      const data: any = await res.json();
      const alt: any = Array.isArray(data?.alternatives)
        ? data.alternatives[0]
        : null;
      if (!alt) {
        toast.info("No AI suggestions");
        return;
      }

      setForm((f) => ({
        ...f,
        meta: {
          ...f.meta,
          directive:
            alt.directive === "halt" || alt.directive === "stable"
              ? (alt.directive as any)
              : ("pass" as any),
          passThroughLine: (
            ["Up Main", "Down Main", "Reverse"] as Line[]
          ).includes(alt.passThroughLine as any)
            ? (alt.passThroughLine as Line)
            : f.meta?.passThroughLine,
          loopStation: (
            ["Chandanpur", "Masagram", "Gurap", "Saktigarh"] as Station[]
          ).includes(alt.loopStation as any)
            ? (alt.loopStation as Station)
            : f.meta?.loopStation,
          loopId: typeof alt.loopId === "number" ? alt.loopId : f.meta?.loopId,
        },
      }));
      if (alt.title) toast.success(alt.title);
      else if (alt.explanation) toast.info(alt.explanation);
      else toast.success("AI suggestion applied");
    } catch (e: any) {
      toast.error(e?.message || "Failed to get AI suggestion");
    }
  }

  const computedMessage = useMemo(() => {
    const dir = (form as any).meta?.directive as
      | undefined
      | "pass"
      | "halt"
      | "stable";
    const line = (form as any).meta?.passThroughLine as any;
    const loopStation = (form as any).meta?.loopStation as any;
    const loopId = (form as any).meta?.loopId as any;

    if (dir === "pass") {
      if (line)
        return `Pass the train through via ${line} Line at target stations.`;
      return "Pass the train through the target stations.";
    }
    if (dir === "halt") {
      return "Halt the train at the target stations.";
    }
    if (dir === "stable") {
      if (loopStation) {
        return `Stable the train at ${loopStation}${loopId ? ` (Loop ${loopId})` : ""}.`;
      }
      return "Stable the train at the target station.";
    }
    return "";
  }, [form]);

  const submit = () => {
    const payload: NewDecision = {
      ...form,
      message: computedMessage,
      effect: {
        loopAssignments:
          form.meta?.loopStation &&
          (form as any).meta?.loopId &&
          form.meta?.consistNo
            ? [
                {
                  station: form.meta.loopStation,
                  loopId: Number((form as any).meta.loopId),
                  train: form.meta.consistNo,
                },
              ]
            : undefined,
      },
    };
    mutation.mutate(payload);
  };

  return (
    <form
      className="rounded-xl border bg-card text-card-foreground p-4 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h3 className="text-base font-semibold">Section Controller</h3>
        <p className="text-xs text-muted-foreground">CDAE - SKG SECTION</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label>Consist No.</Label>
          <Input
            placeholder="e.g. 13024"
            value={(form as any).meta?.consistNo ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                meta: { ...f.meta, consistNo: e.target.value },
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Consist Destination</Label>
          <Textarea
            placeholder="Destination details"
            value={(form as any).meta?.consistDestination ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                meta: { ...f.meta, consistDestination: e.target.value },
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Will be passed through</Label>
          <RadioGroup
            value={(form as any).meta?.passThroughLine as any}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                meta: { ...f.meta, passThroughLine: v as Line },
              }))
            }
            className="grid sm:grid-cols-3 gap-2"
          >
            {(["Up Main", "Reverse", "Down Main"] as Line[]).map((ln) => (
              <label
                key={ln}
                className="flex items-center gap-2 rounded-md border p-2 cursor-pointer"
              >
                <RadioGroupItem value={ln} id={`ln-${ln}`} />
                <span>{ln} Line</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Station to be looped/stabled</Label>
          <RadioGroup
            value={(form as any).meta?.loopStation as any}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                meta: {
                  ...f.meta,
                  loopStation: v as Station,
                  loopId: 1 as any,
                },
              }))
            }
            className="grid sm:grid-cols-4 gap-2"
          >
            {["Chandanpur", "Gurap", "Masagram", "Saktigarh"].map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 rounded-md border p-2 cursor-pointer"
              >
                <RadioGroupItem value={s} id={`st-${s}`} />
                <span className="uppercase text-sm">{s}</span>
              </label>
            ))}
          </RadioGroup>
          {(form as any).meta?.loopStation &&
          loopsByStation[(form as any).meta.loopStation] ? (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Loop</Label>
                <Select
                  value={String((form as any).meta?.loopId ?? 1)}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      meta: { ...f.meta, loopId: Number(v) as any },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select loop" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({
                      length: loopsByStation[(form as any).meta.loopStation],
                    }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Loop {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Train (auto from Consist No.)</Label>
                <Input value={(form as any).meta?.consistNo ?? ""} readOnly />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Current Position</Label>
            <Input
              placeholder="e.g. Passing Belmuri"
              value={(form as any).meta?.currentPosition ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meta: { ...f.meta, currentPosition: e.target.value },
                }))
              }
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as Category }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, priority: v as Priority }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Directive to Station Masters</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suggestWithAI}
            >
              Suggest with AI
            </Button>
          </div>
          <Select
            value={(form as any).meta?.directive ?? "pass"}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                meta: { ...f.meta, directive: v as any },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select directive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Pass through</SelectItem>
              <SelectItem value="halt">Halt at target station</SelectItem>
              <SelectItem value="stable">Stable at target station</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{computedMessage}</p>
        </div>

        <div className="space-y-2">
          <Label>Target Stations (enroute)</Label>
          <div className="flex flex-wrap gap-2">
            {allStations.map((s) => {
              const active = form.targets.includes(s);
              return (
                <Button
                  key={s}
                  type="button"
                  variant={active ? "default" : "outline"}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      targets: active
                        ? f.targets.filter((x) => x !== s)
                        : [...f.targets, s],
                    }))
                  }
                >
                  {s}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={mutation.isPending || !computedMessage.trim()}
        >
          {mutation.isPending ? "Issuing..." : "Issue Decision"}
        </Button>
      </div>
    </form>
  );
}
