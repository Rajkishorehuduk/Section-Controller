import { useMemo, useState } from "react";
import { Bot, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DecisionsResponse, Line, Priority, Station } from "@shared/api";

const stationCodeOptions = [
  { code: "CDAE", name: "Chandanpur" },
  { code: "PBZ", name: "Porabazar" },
  { code: "BMAE", name: "Belmuri" },
  { code: "DNHL", name: "Dhaniakhali Halt" },
  { code: "SHBC", name: "Sibaichandi" },
  { code: "HIH", name: "Hajigarh" },
  { code: "GRAE", name: "Gurap" },
  { code: "JPQ", name: "Jhapandanga" },
  { code: "JRAE", name: "Jaugram" },
  { code: "NBAE", name: "Nabagram" },
  { code: "MSAE", name: "Masagram" },
  { code: "CHC", name: "Chanchai" },
  { code: "PRAE", name: "Palla Road" },
  { code: "SKG", name: "Saktigarh" },
] as const;

const lineFromDirection = (dir?: "Up" | "Down"): Line | undefined =>
  dir === "Up" ? "Up Main" : dir === "Down" ? "Down Main" : undefined;

export function AIAssistant() {
  const [open, setOpen] = useState(false);

  // Form state per Google Form structure
  const [priority, setPriority] = useState<"High" | "Medium" | "Low" | "">("");
  const [trainType, setTrainType] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [direction, setDirection] = useState<"Up" | "Down" | "">("");
  const [currentStationCode, setCurrentStationCode] = useState<string>("");
  const [categoryChoice, setCategoryChoice] = useState<
    "Pass Through" | "Loop at Some Station" | ""
  >("");

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
    const loads: Record<Line, number> = {
      "Up Main": 0,
      "Down Main": 0,
      Reverse: 0,
    } as any;
    const blocked: Partial<Record<Line, boolean>> = {};
    const now = Date.now();
    const active = (decisionsData?.decisions ?? []).filter((d) => {
      const eff = new Date(d.effectiveAt).getTime();
      const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : Infinity;
      return eff <= now && now < exp;
    });
    for (const d of active) {
      if (d.meta?.passThroughLine) loads[d.meta.passThroughLine] += 1;
      const tc = d.meta?.trackClosure?.toLowerCase() || "";
      if (tc.includes("up") && tc.includes("main")) blocked["Up Main"] = true;
      if (tc.includes("down") && tc.includes("main"))
        blocked["Down Main"] = true;
      if (tc.includes("reverse")) blocked["Reverse"] = true;
    }
    return { loads, blocked };
  }, [decisionsData]);

  const reset = () => {
    setPriority("");
    setTrainType("");
    setDestination("");
    setDirection("");
    setCurrentStationCode("");
    setCategoryChoice("");
  };

  const submit = async () => {
    try {
      const mappedPriority: Priority =
        priority === "High" ? "High" : priority === "Medium" ? "Normal" : "Low";

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live,
          inputs: {
            priority: mappedPriority,
            destination,
            currentPosition: currentStationCode
              ? `At ${currentStationCode}`
              : undefined,
          },
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "AI service failed");
      }
      const data: any = await res.json();
      const alt = Array.isArray(data?.alternatives)
        ? data.alternatives[0]
        : null;
      if (!alt) {
        toast.info("No AI decision available");
        return;
      }

      const meta: any = {
        trainType,
        consistDestination: destination,
        direction: direction || undefined,
        currentStationCode: currentStationCode || undefined,
        directive:
          alt.directive === "halt" || alt.directive === "stable"
            ? alt.directive
            : "pass",
        passThroughLine: (
          ["Up Main", "Down Main", "Reverse"] as Line[]
        ).includes(alt.passThroughLine as any)
          ? (alt.passThroughLine as Line)
          : undefined,
        loopStation: (
          ["Chandanpur", "Masagram", "Gurap", "Saktigarh"] as Station[]
        ).includes(alt.loopStation as any)
          ? (alt.loopStation as Station)
          : undefined,
        loopId: typeof alt.loopId === "number" ? alt.loopId : undefined,
      };

      const detail = { priority: mappedPriority, meta };
      const evt = new CustomEvent("ai-recommendation-apply", { detail });
      window.dispatchEvent(evt);

      if (alt.title) toast.success(alt.title);
      else if (alt.explanation) toast.success(alt.explanation);
      else toast.success("AI decision applied");

      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch AI decision");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : setOpen(false))}
      >
        <DialogContent className="w-full max-w-xl p-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Bot className="h-6 w-6 text-primary" /> Train Information Form
              </DialogTitle>
              <DialogDescription>
                Please provide the details for the train operations.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Train Priority</label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Train Type</label>
                <Select
                  value={trainType}
                  onValueChange={(v) => setTrainType(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Express">Express</SelectItem>
                    <SelectItem value="Passenger">Passenger</SelectItem>
                    <SelectItem value="Superfast">Superfast</SelectItem>
                    <SelectItem value="MEMU/DEMU">MEMU/DEMU</SelectItem>
                    <SelectItem value="Mail">Mail</SelectItem>
                    <SelectItem value="Goods/Freight">Goods/Freight</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Destination</label>
                <Input
                  placeholder="Your answer"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Direction</label>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Up">Up</SelectItem>
                    <SelectItem value="Down">Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Station</label>
                <Select
                  value={currentStationCode}
                  onValueChange={(v) => setCurrentStationCode(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {stationCodeOptions.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={categoryChoice}
                  onValueChange={(v) => setCategoryChoice(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pass Through">Pass Through</SelectItem>
                    <SelectItem value="Loop at Some Station">
                      Loop at Some Station
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {priority || direction ? (
                <div className="text-xs text-muted-foreground">
                  Live occupancy — Up: {live.loads["Up Main"] ?? 0}, Down:{" "}
                  {live.loads["Down Main"] ?? 0}, Reverse:{" "}
                  {live.loads["Reverse"] ?? 0}. Blocked:{" "}
                  {(["Up Main", "Down Main", "Reverse"] as Line[])
                    .filter((l) => live.blocked[l])
                    .join(", ") || "None"}
                  .
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={reset}>
                  Clear form
                </Button>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={
                    !priority ||
                    !direction ||
                    !currentStationCode ||
                    !categoryChoice
                  }
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
