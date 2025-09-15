import { DecisionForm } from "@/components/rail/DecisionForm";
import { DecisionList } from "@/components/rail/DecisionList";
import { SectionStatus } from "@/components/rail/SectionStatus";
import { TrackClosureReport } from "@/components/rail/TrackClosureReport";

export default function Index() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-background to-primary/5">
      <div className="container py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionStatus />
            <DecisionForm />
            <TrackClosureReport />
          </div>
          <div className="lg:col-span-1">
            <DecisionList />
          </div>
        </div>
      </div>
    </div>
  );
}
