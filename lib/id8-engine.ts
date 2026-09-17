import { randomUUID } from "node:crypto";
import type { StateFirstDB } from "@feltdb/core";
import type {
  ActionRecord,
  AgentRecord,
  Artifact,
  Attention,
  Decision,
  DomainEvent,
  Evaluation,
  Evidence,
  Intent,
  Interaction,
  Organization,
  Outcome,
  Person,
  Plan,
  RelationshipRecord,
  Requirement,
  WorkItem,
} from "@/lib/id8-types";

const SEED_KEY = "id8-poc-v1";
type Versioned<T> = T & { __version?: number };
const insuranceActions = ["present_proposal", "request_changes", "defer"];
const onboardingActions = ["activate", "request_information", "defer"];

function performerIdForPlan(plan: Plan) {
  return plan.domain === "Insurance" ? "agent-underwriting" : "agent-onboarding";
}

function timestamp(base: string, minutes: number) {
  return new Date(new Date(base).getTime() + minutes * 60_000).toISOString();
}

function createEvent(
  situationId: string,
  type: string,
  actor: string,
  entityType: string,
  entityId: string,
  summary: string,
  createdAt: string,
  payload: Record<string, unknown> = {},
): DomainEvent {
  return {
    id: `evt-${entityType}-${entityId}-${createdAt}`,
    situationId,
    type,
    createdAt,
    actor,
    entityType,
    entityId,
    summary,
    payload,
  };
}

async function recordEvent(
  db: StateFirstDB,
  event: Omit<DomainEvent, "id"> & { id?: string },
) {
  await db.collection<DomainEvent>("events").insert({
    ...event,
    id: event.id ?? `evt-${randomUUID()}`,
  });
}

async function insertAll<T extends { id: string }>(db: StateFirstDB, collectionName: string, items: T[]) {
  const collection = db.collection<T>(collectionName);
  for (const item of items) {
    await collection.insert(item, item.id);
  }
}

export async function ensureSeedData(db: StateFirstDB) {
  const seed = db.collection<{ id: string; seededAt: string }>("seed_meta");
  const existing = await seed.get(SEED_KEY);

  if (existing) {
    const plans = await db.collection<Plan>("plans").all();
    const evaluationsCount = await db.collection<Evaluation>("evaluations").count();
    const decisionsCount = await db.collection<Decision>("decisions").count();

    if (evaluationsCount === 0 || decisionsCount === 0) {
      for (const plan of plans) {
        await rebuildPlanState(db, plan.id, "system:derived-state-rebuild");
      }
    }

    return;
  }

  const base = "2026-09-01T14:00:00.000Z";
  const actor = "system:bootstrap";

  const people: Person[] = [
    {
      id: "person-jane-smith",
      name: "Jane Smith",
      email: "jane.smith@abcmedical.example",
      title: "Practice Administrator",
      organizationId: "org-abc-medical",
      facts: [
        { label: "Relationship", value: "Prospect", status: "known" },
        { label: "Decision role", value: "Primary contact", status: "known" },
      ],
    },
    {
      id: "person-marcus-lee",
      name: "Marcus Lee",
      email: "marcus@northwind.example",
      title: "IT Director",
      organizationId: "org-northwind-clinic",
      facts: [
        { label: "Implementation owner", value: "Technical lead", status: "known" },
        { label: "Billing approver", value: "Unknown", status: "unknown" },
      ],
    },
  ];

  const organizations: Organization[] = [
    {
      id: "org-abc-medical",
      name: "ABC Medical",
      type: "Prospect",
      industry: "Medical practice",
      location: "Providence, RI",
      facts: [
        { label: "Employees", value: "42", status: "known" },
        { label: "Requested coverages", value: "GL/PL + Property + WC", status: "known" },
      ],
    },
    {
      id: "org-northwind-clinic",
      name: "Northwind Clinic",
      type: "Customer",
      industry: "Multi-site healthcare",
      location: "Hartford, CT",
      facts: [
        { label: "Contract", value: "Signed MSA", status: "known" },
        { label: "Payment method", value: "Pending ACH form", status: "unknown" },
      ],
    },
  ];

  const relationships: RelationshipRecord[] = [
    {
      id: "rel-jane-works-for-abc",
      fromType: "person",
      fromId: "person-jane-smith",
      toType: "organization",
      toId: "org-abc-medical",
      type: "works_for",
      status: "active",
    },
    {
      id: "rel-abc-prospect-pna",
      fromType: "organization",
      fromId: "org-abc-medical",
      toType: "organization",
      toId: "org-pna",
      type: "prospect",
      status: "active",
    },
    {
      id: "rel-marcus-works-for-northwind",
      fromType: "person",
      fromId: "person-marcus-lee",
      toType: "organization",
      toId: "org-northwind-clinic",
      type: "works_for",
      status: "active",
    },
  ];

  const interactions: Interaction[] = [
    {
      id: "interaction-abc-1",
      situationId: "situation-abc-quote",
      occurredAt: timestamp(base, 0),
      channel: "call",
      summary: "Initial conversation about package coverage for the medical practice.",
      participantIds: ["person-jane-smith"],
    },
    {
      id: "interaction-abc-2",
      situationId: "situation-abc-quote",
      occurredAt: timestamp(base, 240),
      channel: "email",
      summary: "Jane sent underwriting details and requested GL/PL, Property, and WC pricing.",
      participantIds: ["person-jane-smith"],
    },
    {
      id: "interaction-northwind-1",
      situationId: "situation-northwind-onboarding",
      occurredAt: timestamp(base, 120),
      channel: "meeting",
      summary: "Kickoff completed; contract and implementation owner confirmed.",
      participantIds: ["person-marcus-lee"],
    },
  ];

  const attentions: Attention[] = [
    {
      id: "attention-abc-outbound-call",
      situationId: "situation-abc-quote",
      type: "outbound_call",
      source: "advisor",
      occurredAt: timestamp(base, 300),
      subject: "Outbound call with Jane Smith",
      rawData: { note: "Discussed quote package timing" },
      status: "converted",
      personId: "person-jane-smith",
      organizationId: "org-abc-medical",
    },
    {
      id: "attention-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      type: "customer_request",
      source: "implementation_portal",
      occurredAt: timestamp(base, 360),
      subject: "Northwind activation request",
      rawData: { request: "Ready to schedule activation once implementation evidence is complete" },
      status: "linked",
      personId: "person-marcus-lee",
      organizationId: "org-northwind-clinic",
    },
  ];

  const intents: Intent[] = [
    {
      id: "intent-abc-insurance",
      situationId: "situation-abc-quote",
      attentionId: "attention-abc-outbound-call",
      type: "obtain_insurance_quote",
      description: "Obtain a complete insurance proposal for ABC Medical.",
      confidence: 0.98,
      status: "confirmed",
    },
    {
      id: "intent-northwind-activate",
      situationId: "situation-northwind-onboarding",
      attentionId: "attention-northwind-onboarding",
      type: "activate_customer",
      description: "Determine whether Northwind Clinic is ready for activation.",
      confidence: 0.93,
      status: "confirmed",
    },
  ];

  const plans: Plan[] = [
    {
      id: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      intentId: "intent-abc-insurance",
      domain: "Insurance",
      objective: "Prepare a complete insurance proposal.",
      status: "active",
      requirementIds: [
        "req-abc-company",
        "req-abc-contact",
        "req-abc-glpl-info",
        "req-abc-property-info",
        "req-abc-wc-info",
        "req-abc-glpl-quote",
        "req-abc-property-quote",
        "req-abc-wc-quote",
        "req-abc-proposal",
      ],
    },
    {
      id: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      intentId: "intent-northwind-activate",
      domain: "Onboarding",
      objective: "Determine whether Northwind Clinic is ready for activation.",
      status: "active",
      requirementIds: [
        "req-northwind-identity",
        "req-northwind-contract",
        "req-northwind-config",
        "req-northwind-payment",
      ],
    },
  ];

  const requirements: Requirement[] = [
    {
      id: "req-abc-company",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "company_identity",
      description: "Company identity verified",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-company"],
      workType: "research_company",
      workTitle: "Verify company identity",
      autoEvidence: {
        type: "company_identity_verified",
        source: "crm",
        subject: "ABC Medical",
        value: { legalName: "ABC Medical", fein: "11-2222222" },
        provenance: "Resolved from existing customer/prospect record.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-abc-contact",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "contact_identity",
      description: "Contact identity verified",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-contact"],
      workType: "verify_contact",
      workTitle: "Verify contact identity",
      autoEvidence: {
        type: "contact_identity_verified",
        source: "crm",
        subject: "Jane Smith",
        value: { name: "Jane Smith", role: "Practice Administrator" },
        provenance: "Matched against the existing relationship graph.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-abc-glpl-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "underwriting_information",
      description: "GL/PL underwriting information gathered",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-glpl-info"],
      workType: "gather_underwriting",
      workTitle: "Gather GL/PL underwriting information",
      autoEvidence: {
        type: "glpl_underwriting_complete",
        source: "advisor",
        subject: "ABC Medical",
        value: { receipts: 2400000, specialties: ["family medicine"] },
        provenance: "Captured from the intake worksheet.",
        confidence: 0.95,
        verification: "known",
      },
    },
    {
      id: "req-abc-property-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "property_information",
      description: "Property information gathered",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-property-info"],
      workType: "gather_property",
      workTitle: "Gather property information",
      autoEvidence: {
        type: "property_information_complete",
        source: "advisor",
        subject: "ABC Medical",
        value: { address: "90 Clinic Drive", locationCount: 1 },
        provenance: "Validated from prior renewal submissions.",
        confidence: 0.92,
        verification: "known",
      },
    },
    {
      id: "req-abc-wc-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "workers_comp_information",
      description: "Workers' compensation information gathered",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-wc-info"],
      workType: "gather_wc",
      workTitle: "Gather workers' compensation information",
      autoEvidence: {
        type: "wc_information_complete",
        source: "advisor",
        subject: "ABC Medical",
        value: { payroll: 980000, employeeCount: 42 },
        provenance: "Confirmed from payroll snapshot supplied by the contact.",
        confidence: 0.94,
        verification: "known",
      },
    },
    {
      id: "req-abc-glpl-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "carrier_quote",
      description: "GL/PL quote received",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-glpl-quote"],
      workType: "retrieve_quote",
      workTitle: "Retrieve GL/PL quote",
      autoEvidence: {
        type: "carrier_quote_received",
        source: "carrier_portal",
        subject: "GL/PL",
        value: { carrier: "Atlas Specialty", annualPremium: 18000 },
        provenance: "Downloaded from the carrier portal.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-abc-property-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "carrier_quote",
      description: "Property quote received",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-property-quote"],
      workType: "retrieve_quote",
      workTitle: "Retrieve Property quote",
      autoEvidence: {
        type: "carrier_quote_received",
        source: "carrier_portal",
        subject: "Property",
        value: { carrier: "Northeast Mutual", annualPremium: 22000 },
        provenance: "Downloaded from the carrier portal.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-abc-wc-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "carrier_quote",
      description: "Workers' compensation quote received",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-wc-quote"],
      workType: "retrieve_quote",
      workTitle: "Retrieve workers' compensation quote",
      autoEvidence: {
        type: "carrier_quote_received",
        source: "carrier_portal",
        subject: "Workers' compensation",
        value: { carrier: "Granite Workers", annualPremium: 14000 },
        provenance: "Downloaded from the carrier portal.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-abc-proposal",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      type: "proposal_document",
      description: "Proposal document assembled",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-abc-proposal"],
      workType: "build_proposal",
      workTitle: "Build consolidated proposal",
      autoEvidence: {
        type: "proposal_document_ready",
        source: "system",
        subject: "ABC Medical proposal",
        value: { totalPremium: 54000, format: "PDF" },
        provenance: "Generated from the completed quote package.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-northwind-identity",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      type: "customer_identity",
      description: "Customer identity verified",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-northwind-identity"],
      workType: "verify_identity",
      workTitle: "Verify customer identity",
      autoEvidence: {
        type: "customer_identity_verified",
        source: "crm",
        subject: "Northwind Clinic",
        value: { customerTier: "Enterprise" },
        provenance: "Resolved from the signed order form.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-northwind-contract",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      type: "contract_ready",
      description: "Contract countersigned",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-northwind-contract"],
      workType: "verify_contract",
      workTitle: "Verify countersigned contract",
      autoEvidence: {
        type: "contract_countersigned",
        source: "docusign",
        subject: "Northwind Clinic MSA",
        value: { signedBy: "Marcus Lee" },
        provenance: "Imported from DocuSign envelope history.",
        confidence: 1,
        verification: "known",
      },
    },
    {
      id: "req-northwind-config",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      type: "implementation_state",
      description: "Configuration checklist completed",
      required: true,
      satisfied: true,
      evidenceIds: ["evidence-northwind-config"],
      workType: "complete_configuration",
      workTitle: "Complete configuration checklist",
      autoEvidence: {
        type: "configuration_complete",
        source: "implementation_agent",
        subject: "Northwind Clinic workspace",
        value: { checklist: "completed" },
        provenance: "Implementation automation completed configuration tasks.",
        confidence: 0.97,
        verification: "known",
      },
    },
    {
      id: "req-northwind-payment",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      type: "payment_method",
      description: "Payment method on file",
      required: true,
      satisfied: false,
      evidenceIds: [],
      workType: "collect_payment",
      workTitle: "Collect ACH authorization form",
      autoEvidence: {
        type: "payment_method_confirmed",
        source: "customer_portal",
        subject: "Northwind Clinic billing profile",
        value: { paymentMethod: "ACH authorization received" },
        provenance: "Submitted by the customer through the billing portal.",
        confidence: 1,
        verification: "known",
      },
    },
  ];

  const artifacts: Artifact[] = [
    {
      id: "artifact-abc-proposal",
      situationId: "situation-abc-quote",
      type: "proposal_pdf",
      name: "ABC Medical Proposal.pdf",
      createdAt: timestamp(base, 430),
      source: "proposal_builder",
      summary: "Consolidated proposal PDF covering GL/PL, Property, and WC.",
    },
    {
      id: "artifact-northwind-contract",
      situationId: "situation-northwind-onboarding",
      type: "contract_pdf",
      name: "Northwind MSA.pdf",
      createdAt: timestamp(base, 180),
      source: "docusign",
      summary: "Fully executed master services agreement.",
    },
  ];

  const evidence: Evidence[] = [
    {
      id: "evidence-abc-company",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-company",
      type: "company_identity_verified",
      source: "crm",
      createdAt: timestamp(base, 310),
      subject: "ABC Medical",
      value: { legalName: "ABC Medical", fein: "11-2222222" },
      provenance: "Resolved from existing customer/prospect record.",
      verification: "known",
    },
    {
      id: "evidence-abc-contact",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-contact",
      type: "contact_identity_verified",
      source: "crm",
      createdAt: timestamp(base, 311),
      subject: "Jane Smith",
      value: { name: "Jane Smith", role: "Practice Administrator" },
      provenance: "Matched against the relationship graph.",
      verification: "known",
    },
    {
      id: "evidence-abc-glpl-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-glpl-info",
      type: "glpl_underwriting_complete",
      source: "advisor",
      createdAt: timestamp(base, 330),
      subject: "ABC Medical GL/PL application",
      value: { receipts: 2400000 },
      provenance: "Captured from intake worksheet.",
      verification: "known",
      confidence: 0.95,
    },
    {
      id: "evidence-abc-property-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-property-info",
      type: "property_information_complete",
      source: "advisor",
      createdAt: timestamp(base, 331),
      subject: "ABC Medical property schedule",
      value: { address: "90 Clinic Drive" },
      provenance: "Validated from prior submissions.",
      verification: "known",
      confidence: 0.92,
    },
    {
      id: "evidence-abc-wc-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-wc-info",
      type: "wc_information_complete",
      source: "advisor",
      createdAt: timestamp(base, 332),
      subject: "ABC Medical payroll",
      value: { payroll: 980000 },
      provenance: "Confirmed from payroll snapshot.",
      verification: "known",
      confidence: 0.94,
    },
    {
      id: "evidence-abc-glpl-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-glpl-quote",
      type: "carrier_quote_received",
      source: "carrier_portal",
      createdAt: timestamp(base, 390),
      subject: "GL/PL quote",
      value: { carrier: "Atlas Specialty", annualPremium: 18000 },
      provenance: "Downloaded from carrier portal.",
      verification: "known",
    },
    {
      id: "evidence-abc-property-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-property-quote",
      type: "carrier_quote_received",
      source: "carrier_portal",
      createdAt: timestamp(base, 391),
      subject: "Property quote",
      value: { carrier: "Northeast Mutual", annualPremium: 22000 },
      provenance: "Downloaded from carrier portal.",
      verification: "known",
    },
    {
      id: "evidence-abc-wc-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-wc-quote",
      type: "carrier_quote_received",
      source: "carrier_portal",
      createdAt: timestamp(base, 392),
      subject: "Workers' compensation quote",
      value: { carrier: "Granite Workers", annualPremium: 14000 },
      provenance: "Downloaded from carrier portal.",
      verification: "known",
    },
    {
      id: "evidence-abc-proposal",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-proposal",
      type: "proposal_document_ready",
      source: "system",
      createdAt: timestamp(base, 430),
      subject: "ABC Medical proposal",
      value: { totalPremium: 54000, coverages: ["GL/PL", "Property", "WC"] },
      artifactId: "artifact-abc-proposal",
      provenance: "Generated from completed quote package.",
      verification: "known",
    },
    {
      id: "evidence-northwind-identity",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      requirementId: "req-northwind-identity",
      type: "customer_identity_verified",
      source: "crm",
      createdAt: timestamp(base, 361),
      subject: "Northwind Clinic",
      value: { customerTier: "Enterprise" },
      provenance: "Resolved from signed order form.",
      verification: "known",
    },
    {
      id: "evidence-northwind-contract",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      requirementId: "req-northwind-contract",
      type: "contract_countersigned",
      source: "docusign",
      createdAt: timestamp(base, 362),
      subject: "Northwind MSA",
      value: { signedBy: "Marcus Lee" },
      artifactId: "artifact-northwind-contract",
      provenance: "Imported from DocuSign.",
      verification: "known",
    },
    {
      id: "evidence-northwind-config",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      requirementId: "req-northwind-config",
      type: "configuration_complete",
      source: "implementation_agent",
      createdAt: timestamp(base, 400),
      subject: "Northwind workspace",
      value: { checklist: "completed" },
      provenance: "Implementation automation completed configuration tasks.",
      verification: "known",
      confidence: 0.97,
    },
  ];

  const agents: AgentRecord[] = [
    { id: "agent-underwriting", name: "Underwriting Runner", type: "agent", role: "Collects underwriting and quote evidence" },
    { id: "agent-onboarding", name: "Onboarding Coordinator", type: "agent", role: "Collects activation requirements and executes work" },
  ];

  const work: WorkItem[] = [
    {
      id: "work-abc-glpl-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-glpl-info",
      lane: "GL/PL",
      type: "gather_underwriting",
      title: "Gather GL/PL underwriting information",
      performerType: "agent",
      performerId: "agent-underwriting",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-glpl-info"],
      completedAt: timestamp(base, 330),
    },
    {
      id: "work-abc-property-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-property-info",
      lane: "Property",
      type: "gather_property",
      title: "Gather property information",
      performerType: "agent",
      performerId: "agent-underwriting",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-property-info"],
      completedAt: timestamp(base, 331),
    },
    {
      id: "work-abc-wc-info",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-wc-info",
      lane: "WC",
      type: "gather_wc",
      title: "Gather workers' compensation information",
      performerType: "agent",
      performerId: "agent-underwriting",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-wc-info"],
      completedAt: timestamp(base, 332),
    },
    {
      id: "work-abc-glpl-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-glpl-quote",
      lane: "GL/PL",
      type: "retrieve_quote",
      title: "Retrieve GL/PL quote",
      performerType: "integration",
      performerId: "carrier-portal",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-glpl-quote"],
      completedAt: timestamp(base, 390),
    },
    {
      id: "work-abc-property-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-property-quote",
      lane: "Property",
      type: "retrieve_quote",
      title: "Retrieve Property quote",
      performerType: "integration",
      performerId: "carrier-portal",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-property-quote"],
      completedAt: timestamp(base, 391),
    },
    {
      id: "work-abc-wc-quote",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-wc-quote",
      lane: "WC",
      type: "retrieve_quote",
      performerType: "integration",
      performerId: "carrier-portal",
      status: "completed",
      title: "Retrieve workers' compensation quote",
      outputEvidenceIds: ["evidence-abc-wc-quote"],
      completedAt: timestamp(base, 392),
    },
    {
      id: "work-abc-proposal",
      planId: "plan-abc-insurance",
      situationId: "situation-abc-quote",
      requirementId: "req-abc-proposal",
      lane: "Proposal",
      type: "build_proposal",
      title: "Build consolidated proposal",
      performerType: "system",
      status: "completed",
      outputEvidenceIds: ["evidence-abc-proposal"],
      completedAt: timestamp(base, 430),
    },
    {
      id: "work-northwind-config",
      planId: "plan-northwind-onboarding",
      situationId: "situation-northwind-onboarding",
      requirementId: "req-northwind-config",
      lane: "Implementation",
      type: "complete_configuration",
      title: "Complete configuration checklist",
      performerType: "agent",
      performerId: "agent-onboarding",
      status: "completed",
      outputEvidenceIds: ["evidence-northwind-config"],
      completedAt: timestamp(base, 400),
    },
  ];

  const initialEvents: DomainEvent[] = [
    createEvent("situation-abc-quote", "attention.created", actor, "attention", "attention-abc-outbound-call", "Outbound call captured as attention.", timestamp(base, 300)),
    createEvent("situation-abc-quote", "context.resolved", actor, "attention", "attention-abc-outbound-call", "Resolved Jane Smith, ABC Medical, and prior interactions.", timestamp(base, 301)),
    createEvent("situation-abc-quote", "intent.created", actor, "intent", "intent-abc-insurance", "Insurance quote intent recorded.", timestamp(base, 302)),
    createEvent("situation-abc-quote", "plan.created", actor, "plan", "plan-abc-insurance", "Insurance proposal plan created from required evidence.", timestamp(base, 303)),
    createEvent("situation-northwind-onboarding", "attention.created", actor, "attention", "attention-northwind-onboarding", "Activation request captured as attention.", timestamp(base, 360)),
    createEvent("situation-northwind-onboarding", "context.resolved", actor, "attention", "attention-northwind-onboarding", "Resolved customer, implementation owner, and contract context.", timestamp(base, 361)),
    createEvent("situation-northwind-onboarding", "intent.created", actor, "intent", "intent-northwind-activate", "Activation intent recorded.", timestamp(base, 362)),
    createEvent("situation-northwind-onboarding", "plan.created", actor, "plan", "plan-northwind-onboarding", "Onboarding readiness plan created from required evidence.", timestamp(base, 363)),
  ];

  await insertAll(db, "people", people);
  await insertAll(db, "organizations", organizations);
  await insertAll(db, "relationships", relationships);
  await insertAll(db, "interactions", interactions);
  await insertAll(db, "attentions", attentions);
  await insertAll(db, "intents", intents);
  await insertAll(db, "plans", plans);
  await insertAll(db, "requirements", requirements);
  await insertAll(db, "work", work);
  await insertAll(db, "evidence", evidence);
  await insertAll(db, "artifacts", artifacts);
  await insertAll(db, "agents", agents);
  await insertAll(db, "events", initialEvents);
  await seed.insert({ id: SEED_KEY, seededAt: new Date().toISOString() }, SEED_KEY);

  for (const plan of plans) {
    await rebuildPlanState(db, plan.id, actor);
  }
}

export async function rebuildPlanState(db: StateFirstDB, planId: string, actor: string) {
  const plans = db.collection<Plan>("plans");
  const requirementsCollection = db.collection<Requirement>("requirements");
  const evidenceCollection = db.collection<Evidence>("evidence");
  const evaluationsCollection = db.collection<Evaluation>("evaluations");
  const decisionsCollection = db.collection<Decision>("decisions");
  const workCollection = db.collection<WorkItem>("work");

  const plan = await plans.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const requirements = await requirementsCollection.find({ planId });
  const evidence = await evidenceCollection.find({ planId });
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const satisfiedRequirementIds: string[] = [];
  const missingRequirementIds: string[] = [];

  for (const requirement of requirements) {
    const linkedEvidenceIds = requirement.evidenceIds.filter((id) => evidenceIds.has(id));
    const satisfied = !requirement.required || linkedEvidenceIds.length > 0;

    if (linkedEvidenceIds.length !== requirement.evidenceIds.length || requirement.satisfied !== satisfied) {
      const current = (await requirementsCollection.get(requirement.id)) as Versioned<Requirement> | null;
      if (current?.__version !== undefined) {
        await requirementsCollection.updateIfVersion(requirement.id, current.__version, {
          evidenceIds: linkedEvidenceIds,
          satisfied,
        });
      }
    }

    if (satisfied) {
      satisfiedRequirementIds.push(requirement.id);
    } else {
      missingRequirementIds.push(requirement.id);
      const existingWork = await workCollection.find({ requirementId: requirement.id });
      const activeWork = existingWork.find((item) => item.status !== "completed");
      if (!activeWork) {
        const completedWork = [...existingWork]
          .filter((item) => item.status === "completed")
          .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""))[0];

        if (completedWork) {
          const currentWork = (await workCollection.get(completedWork.id)) as Versioned<WorkItem> | null;
          if (currentWork?.__version !== undefined) {
            await workCollection.updateIfVersion(completedWork.id, currentWork.__version, {
              status: "queued",
              performerId: performerIdForPlan(plan),
              completedAt: undefined,
              outputEvidenceIds: [],
            });
          }
          await recordEvent(db, {
            situationId: plan.situationId,
            type: "work.created",
            createdAt: new Date().toISOString(),
            actor,
            entityType: "work",
            entityId: completedWork.id,
            summary: `${completedWork.title} was reopened to satisfy missing evidence.`,
            payload: { requirementId: requirement.id },
          });
          continue;
        }

        const workItem: WorkItem = {
          id: `work-${requirement.id}-${Date.now()}`,
          planId,
          situationId: plan.situationId,
          requirementId: requirement.id,
          lane: plan.domain,
          type: requirement.workType,
          title: requirement.workTitle,
          performerType: "agent",
          performerId: performerIdForPlan(plan),
          status: "queued",
          outputEvidenceIds: [],
        };
        await workCollection.insert(workItem, workItem.id);
        await recordEvent(db, {
          situationId: plan.situationId,
          type: "work.created",
          createdAt: new Date().toISOString(),
          actor,
          entityType: "work",
          entityId: workItem.id,
          summary: `${workItem.title} created to satisfy missing evidence.`,
          payload: { requirementId: requirement.id },
        });
      }
    }
  }

  const status = missingRequirementIds.length === 0 ? "ready" : "not_ready";
  const rationale =
    status === "ready"
      ? "All required evidence is present. The situation is decision-ready."
      : `Missing evidence for ${missingRequirementIds.length} required item${missingRequirementIds.length === 1 ? "" : "s"}. Continue work until evidence is collected.`;

  const evaluation: Evaluation = {
    id: `evaluation-${planId}-${Date.now()}`,
    planId,
    situationId: plan.situationId,
    evaluatedAt: new Date().toISOString(),
    status,
    satisfiedRequirementIds,
    missingRequirementIds,
    rationale,
    evidenceIds: evidence.map((item) => item.id),
  };

  await evaluationsCollection.insert(evaluation, evaluation.id);
  await recordEvent(db, {
    situationId: plan.situationId,
    type: "evaluation.completed",
    createdAt: evaluation.evaluatedAt,
    actor,
    entityType: "evaluation",
    entityId: evaluation.id,
    summary: rationale,
    payload: { status, missingRequirementIds },
  });

  const decisions = await decisionsCollection.find({ planId });
  const decision = decisions[0];
  const nextDecisionStatus = status === "ready" ? "ready" : "waiting";

  if (!decision) {
    const newDecision: Decision = {
      id: `decision-${planId}`,
      planId,
      situationId: plan.situationId,
      type: plan.domain === "Insurance" ? "present_proposal" : "activate_customer",
      title: plan.domain === "Insurance" ? "Present insurance proposal" : "Activate customer",
      status: nextDecisionStatus,
      evaluationId: evaluation.id,
      availableActions: plan.domain === "Insurance" ? insuranceActions : onboardingActions,
    };
    await decisionsCollection.insert(newDecision, newDecision.id);
    if (nextDecisionStatus === "ready") {
      await recordEvent(db, {
        situationId: plan.situationId,
        type: "decision.ready",
        createdAt: new Date().toISOString(),
        actor,
        entityType: "decision",
        entityId: newDecision.id,
        summary: `${newDecision.title} is ready for human judgment.`,
        payload: { evaluationId: evaluation.id },
      });
    }
  } else if (decision.status !== "made" && decision.status !== "deferred") {
    const current = (await decisionsCollection.get(decision.id)) as Versioned<Decision> | null;
    if (current?.__version !== undefined) {
      const previousStatus = current.status;
      await decisionsCollection.updateIfVersion(decision.id, current.__version, {
        status: nextDecisionStatus,
        evaluationId: evaluation.id,
      });
      if (previousStatus !== "ready" && nextDecisionStatus === "ready") {
        await recordEvent(db, {
          situationId: plan.situationId,
          type: "decision.ready",
          createdAt: new Date().toISOString(),
          actor,
          entityType: "decision",
          entityId: decision.id,
          summary: `${decision.title} is ready for human judgment.`,
          payload: { evaluationId: evaluation.id },
        });
      }
    }
  }

  const planCurrent = (await plans.get(plan.id)) as Versioned<Plan> | null;
  if (planCurrent?.__version !== undefined) {
    await plans.updateIfVersion(plan.id, planCurrent.__version, {
      status: status === "ready" ? "ready" : "active",
    });
  }
}

export async function completeMissingRequirements(db: StateFirstDB, planId: string, actor: string) {
  const requirementsCollection = db.collection<Requirement>("requirements");
  const evidenceCollection = db.collection<Evidence>("evidence");
  const workCollection = db.collection<WorkItem>("work");

  const requirements = await requirementsCollection.find({ planId });
  const missing = requirements.filter((item) => item.required && item.evidenceIds.length === 0);

  for (const requirement of missing) {
    const evidenceId = `evidence-${requirement.id}-${Date.now()}`;
    const evidence: Evidence = {
      id: evidenceId,
      planId,
      situationId: requirement.situationId,
      requirementId: requirement.id,
      type: requirement.autoEvidence.type,
      source: requirement.autoEvidence.source,
      createdAt: new Date().toISOString(),
      subject: requirement.autoEvidence.subject,
      value: requirement.autoEvidence.value,
      provenance: requirement.autoEvidence.provenance,
      confidence: requirement.autoEvidence.confidence,
      verification: requirement.autoEvidence.verification,
    };
    await evidenceCollection.insert(evidence, evidence.id);

    const currentRequirement = (await requirementsCollection.get(requirement.id)) as Versioned<Requirement> | null;
    if (currentRequirement?.__version !== undefined) {
      await requirementsCollection.updateIfVersion(requirement.id, currentRequirement.__version, {
        satisfied: true,
        evidenceIds: [...currentRequirement.evidenceIds, evidence.id],
      });
    }

    const matchingWork = await workCollection.find({ requirementId: requirement.id });
    for (const workItem of matchingWork.filter((item) => item.status !== "completed")) {
      const currentWork = (await workCollection.get(workItem.id)) as Versioned<WorkItem> | null;
      if (currentWork?.__version !== undefined) {
        await workCollection.updateIfVersion(workItem.id, currentWork.__version, {
          status: "completed",
          outputEvidenceIds: [...currentWork.outputEvidenceIds, evidence.id],
          completedAt: evidence.createdAt,
        });
        await recordEvent(db, {
          situationId: requirement.situationId,
          type: "work.completed",
          createdAt: evidence.createdAt,
          actor,
          entityType: "work",
          entityId: workItem.id,
          summary: `${workItem.title} completed and produced evidence.`,
          payload: { evidenceId },
        });
      }
    }

    await recordEvent(db, {
      situationId: requirement.situationId,
      type: "evidence.created",
      createdAt: evidence.createdAt,
      actor,
      entityType: "evidence",
      entityId: evidence.id,
      summary: `${requirement.description} is now evidenced.`,
      payload: { requirementId: requirement.id },
    });
  }

  await rebuildPlanState(db, planId, actor);
}

export async function makeDecision(
  db: StateFirstDB,
  decisionId: string,
  actionType: string,
  actor: string,
) {
  const decisionsCollection = db.collection<Decision>("decisions");
  const actionsCollection = db.collection<ActionRecord>("actions");
  const outcomesCollection = db.collection<Outcome>("outcomes");
  const attentionsCollection = db.collection<Attention>("attentions");

  const decision = (await decisionsCollection.get(decisionId)) as Versioned<Decision> | null;
  if (!decision) {
    throw new Error(`Decision ${decisionId} not found`);
  }

  if (decision.status === "made" || decision.status === "deferred") {
    return decision;
  }

  if (decision.status !== "ready") {
    throw new Error("Decision is not yet ready");
  }

  const supportedActions = decision.type === "activate_customer" ? onboardingActions : insuranceActions;
  if (!supportedActions.includes(actionType)) {
    throw new Error(`Unsupported action '${actionType}' for decision ${decisionId}`);
  }

  const madeAt = new Date().toISOString();
  if (decision.__version !== undefined) {
    const nextStatus = actionType === "defer" ? "deferred" : "made";
    const updateResult = await decisionsCollection.updateIfVersion(decisionId, decision.__version, {
      status: nextStatus,
      madeAt,
      lastActionType: actionType,
    });
    if (!updateResult.updated) {
      throw new Error(`Decision ${decisionId} changed before it could be acted on.`);
    }
  }

  const action: ActionRecord = {
    id: `action-${decisionId}-${Date.now()}`,
    decisionId,
    situationId: decision.situationId,
    type: actionType,
    parameters: { actionType },
    status: "completed",
    executedAt: madeAt,
    result: {
      message:
        actionType === "present_proposal"
          ? "Proposal sent to the prospect"
          : actionType === "request_changes"
            ? "Requested adjustments before presentation"
            : actionType === "activate"
              ? "Customer activated and kickoff triggered"
              : actionType === "request_information"
                ? "Requested missing activation context"
                : "Deferred for later follow-up",
    },
  };
  await actionsCollection.insert(action, action.id);

  let createdAttentionId: string | undefined;
  let summary = "Decision recorded.";
  if (actionType === "present_proposal") {
    createdAttentionId = `attention-${action.id}-follow-up`;
    await attentionsCollection.insert(
      {
        id: createdAttentionId,
        situationId: decision.situationId,
        type: "customer_reply",
        source: "email_delivery",
        occurredAt: madeAt,
        subject: "Prospect requested follow-up after proposal delivery",
        rawData: { delivery: "successful", nextStep: "schedule follow-up" },
        status: "new",
      },
      createdAttentionId,
    );
    summary = "Proposal delivered and new follow-up attention created.";
  } else if (actionType === "request_changes") {
    createdAttentionId = `attention-${action.id}-changes`;
    await attentionsCollection.insert(
      {
        id: createdAttentionId,
        situationId: decision.situationId,
        type: "human_request",
        source: "decision_inbox",
        occurredAt: madeAt,
        subject: "Human requested changes before final presentation",
        rawData: { reason: "Adjust proposal before send" },
        status: "new",
      },
      createdAttentionId,
    );
    summary = "Change request captured as new attention.";
  } else if (actionType === "activate") {
    createdAttentionId = `attention-${action.id}-kickoff`;
    await attentionsCollection.insert(
      {
        id: createdAttentionId,
        situationId: decision.situationId,
        type: "scheduled_event",
        source: "activation_workflow",
        occurredAt: madeAt,
        subject: "Implementation kickoff scheduled after activation",
        rawData: { status: "scheduled", nextStep: "handoff to onboarding team" },
        status: "new",
      },
      createdAttentionId,
    );
    summary = "Customer activated and kickoff attention created.";
  } else if (actionType === "request_information") {
    createdAttentionId = `attention-${action.id}-info-request`;
    await attentionsCollection.insert(
      {
        id: createdAttentionId,
        situationId: decision.situationId,
        type: "customer_request",
        source: "decision_inbox",
        occurredAt: madeAt,
        subject: "Additional activation information requested",
        rawData: { reason: "Need more implementation detail before activation" },
        status: "new",
      },
      createdAttentionId,
    );
    summary = "Additional activation information requested and captured as attention.";
  }

  const outcome: Outcome = {
    id: `outcome-${action.id}`,
    actionId: action.id,
    situationId: decision.situationId,
    type: actionType,
    createdAt: madeAt,
    status: "completed",
    summary,
    createdAttentionId,
  };
  await outcomesCollection.insert(outcome, outcome.id);

  await recordEvent(db, {
    situationId: decision.situationId,
    type: "decision.made",
    createdAt: madeAt,
    actor,
    entityType: "decision",
    entityId: decisionId,
    summary: `Human chose ${actionType}.`,
    payload: { actionType },
  });
  await recordEvent(db, {
    situationId: decision.situationId,
    type: "action.completed",
    createdAt: madeAt,
    actor,
    entityType: "action",
    entityId: action.id,
    summary,
    payload: { outcomeId: outcome.id },
  });
  await recordEvent(db, {
    situationId: decision.situationId,
    type: "outcome.created",
    createdAt: madeAt,
    actor,
    entityType: "outcome",
    entityId: outcome.id,
    summary,
    payload: { createdAttentionId },
  });

  return decisionsCollection.get(decisionId);
}
