export type VerificationStatus = "known" | "inferred" | "unknown";
export type AttentionStatus = "new" | "triaged" | "linked" | "dismissed" | "converted";
export type IntentStatus = "explicit" | "inferred" | "confirmed" | "rejected";
export type PlanStatus = "active" | "ready" | "completed";
export type WorkStatus = "queued" | "in_progress" | "completed";
export type EvaluationStatus = "ready" | "not_ready";
export type DecisionStatus = "waiting" | "ready" | "made" | "deferred";
export type ActionStatus = "pending" | "completed";

export interface ContextFact {
  label: string;
  value: string;
  status: VerificationStatus;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  title: string;
  organizationId: string;
  facts: ContextFact[];
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  industry: string;
  location: string;
  facts: ContextFact[];
}

export interface RelationshipRecord {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  type: string;
  status: string;
}

export interface Interaction {
  id: string;
  situationId: string;
  occurredAt: string;
  channel: string;
  summary: string;
  participantIds: string[];
}

export interface Attention {
  id: string;
  situationId: string;
  type: string;
  source: string;
  occurredAt: string;
  subject: string;
  rawData: Record<string, unknown>;
  status: AttentionStatus;
  personId?: string;
  organizationId?: string;
}

export interface Intent {
  id: string;
  situationId: string;
  attentionId: string;
  type: string;
  description: string;
  confidence: number;
  status: IntentStatus;
}

export interface Plan {
  id: string;
  situationId: string;
  intentId: string;
  domain: string;
  objective: string;
  status: PlanStatus;
  requirementIds: string[];
}

export interface Requirement {
  id: string;
  planId: string;
  situationId: string;
  type: string;
  description: string;
  required: boolean;
  satisfied: boolean;
  evidenceIds: string[];
  workType: string;
  workTitle: string;
  autoEvidence: {
    type: string;
    source: string;
    subject: string;
    value: Record<string, unknown>;
    provenance: string;
    confidence: number;
    verification: Exclude<VerificationStatus, "unknown">;
  };
}

export interface WorkItem {
  id: string;
  planId: string;
  situationId: string;
  requirementId: string;
  lane: string;
  type: string;
  title: string;
  performerType: "agent" | "human" | "integration" | "system" | "external";
  performerId?: string;
  status: WorkStatus;
  outputEvidenceIds: string[];
  completedAt?: string;
}

export interface Artifact {
  id: string;
  situationId: string;
  type: string;
  name: string;
  createdAt: string;
  source: string;
  summary: string;
}

export interface Evidence {
  id: string;
  planId: string;
  situationId: string;
  requirementId: string;
  type: string;
  source: string;
  createdAt: string;
  subject: string;
  value: Record<string, unknown>;
  artifactId?: string;
  confidence?: number;
  provenance: string;
  verification: VerificationStatus;
}

export interface Evaluation {
  id: string;
  planId: string;
  situationId: string;
  evaluatedAt: string;
  status: EvaluationStatus;
  satisfiedRequirementIds: string[];
  missingRequirementIds: string[];
  rationale: string;
  evidenceIds: string[];
}

export interface Decision {
  id: string;
  planId: string;
  situationId: string;
  type: string;
  title: string;
  status: DecisionStatus;
  evaluationId: string;
  availableActions: string[];
  madeAt?: string;
  lastActionType?: string;
}

export interface ActionRecord {
  id: string;
  decisionId: string;
  situationId: string;
  type: string;
  parameters: Record<string, unknown>;
  status: ActionStatus;
  executedAt: string;
  result: Record<string, unknown>;
}

export interface Outcome {
  id: string;
  actionId: string;
  situationId: string;
  type: string;
  createdAt: string;
  status: string;
  summary: string;
  createdAttentionId?: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  type: string;
  role: string;
}

export interface DomainEvent {
  id: string;
  situationId: string;
  type: string;
  createdAt: string;
  actor: string;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
}
