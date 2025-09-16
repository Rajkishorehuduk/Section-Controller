import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface FormState {
  priority: "High" | "Medium" | "Low" | "";
  trainType:
    | "Express"
    | "Passenger"
    | "Superfast"
    | "MEMU/DEMU"
    | "Mail"
    | "Goods/Freight"
    | "";
  destination: string;
  direction: "Up" | "Down" | "";
  currentStation:
    | "CDAE"
    | "PBZ"
    | "BMAE"
    | "DNHL"
    | "SHBC"
    | "HIH"
    | "GRAE"
    | "JPQ"
    | "JRAE"
    | "NBAE"
    | "MSAE"
    | "CHC"
    | "PRAE"
    | "SKG"
    | "";
  category: "Pass Through" | "Loop at Some Station" | "";
}

const initialState: FormState = {
  priority: "",
  trainType: "",
  destination: "",
  direction: "",
  currentStation: "",
  category: "",
};

export default function AIAssistantPage() {
  const [data, setData] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      window.dispatchEvent(
        new CustomEvent("ai-form-submit", { detail: { ...data } }),
      );
      toast({
        title: "Form submitted",
        description: "Your train information was recorded.",
      });
      setData(initialState);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-background to-primary/5">
      <div className="container max-w-3xl py-8">
        <Card className="border-0 shadow-none">
          <div className="px-6 pt-6">
            <h1 className="text-2xl font-semibold leading-tight">
              Train Information Form
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Please provide the details for the train operations.
            </p>
          </div>

          <div className="mt-6 space-y-6 px-6 pb-6">
            <div className="space-y-2">
              <Label>Train Priority</Label>
              <Select
                value={data.priority}
                onValueChange={(v) =>
                  setData((s) => ({
                    ...s,
                    priority: v as FormState["priority"],
                  }))
                }
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
              <Label>Train Type</Label>
              <Select
                value={data.trainType}
                onValueChange={(v) =>
                  setData((s) => ({
                    ...s,
                    trainType: v as FormState["trainType"],
                  }))
                }
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
              <Label>Destination</Label>
              <Input
                placeholder="Your answer"
                value={data.destination}
                onChange={(e) =>
                  setData((s) => ({ ...s, destination: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={data.direction}
                onValueChange={(v) =>
                  setData((s) => ({
                    ...s,
                    direction: v as FormState["direction"],
                  }))
                }
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
              <Label>Current Station</Label>
              <Select
                value={data.currentStation}
                onValueChange={(v) =>
                  setData((s) => ({
                    ...s,
                    currentStation: v as FormState["currentStation"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDAE">CDAE</SelectItem>
                  <SelectItem value="PBZ">PBZ</SelectItem>
                  <SelectItem value="BMAE">BMAE</SelectItem>
                  <SelectItem value="DNHL">DNHL</SelectItem>
                  <SelectItem value="SHBC">SHBC</SelectItem>
                  <SelectItem value="HIH">HIH</SelectItem>
                  <SelectItem value="GRAE">GRAE</SelectItem>
                  <SelectItem value="JPQ">JPQ</SelectItem>
                  <SelectItem value="JRAE">JRAE</SelectItem>
                  <SelectItem value="NBAE">NBAE</SelectItem>
                  <SelectItem value="MSAE">MSAE</SelectItem>
                  <SelectItem value="CHC">CHC</SelectItem>
                  <SelectItem value="PRAE">PRAE</SelectItem>
                  <SelectItem value="SKG">SKG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={data.category}
                onValueChange={(v) =>
                  setData((s) => ({
                    ...s,
                    category: v as FormState["category"],
                  }))
                }
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

            <div className="pt-2">
              <Button onClick={onSubmit} disabled={submitting}>
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
