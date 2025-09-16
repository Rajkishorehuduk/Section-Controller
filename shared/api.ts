/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export type Station =
  | "Chandanpur"
  | "Porabazar"
  | "Belmuri"
  | "Dhaniakhali Halt"
  | "Sibaichandi"
  | "Hajigarh"
  | "Gurap"
  | "Jhapandanga"
  | "Jaugram"
  | "Nabagram"
  | "Masagram"
  | "Chanchai"
  | "Palla Road"
  | "Saktigarh";

export type Priority = "Low" | "Normal" | "High" | "Critical";

export type Category =
  | "Movement"
  | "Maintenance"
  | "Safety"
  | "Power"
  | "Emergency";

export type Status = "Free" | "Occupied" | "Blocked" | "Maintenance";
export type Line = "Up Main" | "Down Main" | "Reverse";

export interface LoopAssignment {
  station: Station;
  loopId: number; // 1-based index
  train: string; // train no/name
}

export interface DecisionEffect {
  lines?: Partial<Record<Line, Status>>;
  stationStatus?: Status;
  loopAssignments?: LoopAssignment[];
}

export interface DecisionMeta {
  consistNo?: string;
  consistDestination?: string;
  passThroughLine?: Line;
  loopStation?: Station;
  loopId?: number;
  trackClosure?: string;
  currentPosition?: string;
  directive?: "pass" | "halt" | "stable";
}

export interface Decision {
  id: string;
  message: string;
  category: Category;
  priority: Priority;
  targets: Station[];
  createdAt: string; // ISO
  effectiveAt: string; // ISO
  expiresAt: string | null; // ISO or null
  author: string;
  acknowledgements: Record<
    Station,
    { acknowledged: boolean; at: string | null }
  >;
  effect?: DecisionEffect;
  meta?: DecisionMeta;
}

export interface NewDecision {
  message: string;
  category: Category;
  priority: Priority;
  targets: Station[];
  effectiveAt?: string; // ISO
  expiresAt?: string | null; // ISO or null
  author?: string;
  effect?: DecisionEffect;
  meta?: DecisionMeta;
}

export interface AckRequest {
  station: Station;
}

export interface DecisionsResponse {
  decisions: Decision[];
}

export interface DecisionResponse {
  decision: Decision;
}

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}
