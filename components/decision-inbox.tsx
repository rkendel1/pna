"use client";

import { useEffect, useMemo, useState } from "react";
import { createFeltDB } from "@feltdb/core";
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
  Requirement,
  WorkItem,
} from "@/lib/id8-types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const actionLabels: Record<string, string> = {
  present_proposal: "Present Proposal",
  request_changes: "Request Changes",
  defer: "Defer",
  activate: "Activate",
  request_information: "Request Information",
};

type Snapshot = {
  people: Person[];
  organizations: Organization[];
  interactions: Interaction[];
  attentions: Attention[];
  intents: Intent[];
  plans: Plan[];
  requirements: Requirement[];
  work: WorkItem[];
  evidence: Evidence[];
  evaluations: Evaluation[];
  decisions: Decision[];
  outcomes: Outcome[];
  actions: ActionRecord[];
  artifacts: Artifact[];
  agents: AgentRecord[];
  events: DomainEvent[];
};

const emptySnapshot: Snapshot = {
  people: [],
  organizations: [],
  interactions: [],
  attentions: [],
  intents: [],
  plans: [],
  requirements: [],
  work: [],
  evidence: [],
  evaluations: [],
  decisions: [],
  outcomes: [],
  actions: [],
  artifacts: [],
  agents: [],
  events: [],
};

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "emerald" | "amber" | "blue" | "slate" | "rose" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-100 text-rose-700",
  }[tone];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{children}</span>;
}

function FactPill({ label, value, status }: { label: string; value: string; status: string }) {
  const tone = status === "known" ? "emerald" : status === "inferred" ? "amber" : "slate";
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
      <span className="font-semibold text-slate-900">{label}:</span> {value} <Badge tone={tone as "emerald" | "amber" | "slate"}>{status}</Badge>
    </div>
  );
}

function actionButtonClass(actionType: string) {
  if (actionType === "present_proposal" || actionType === "activate") {
    return "w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  }

  if (actionType === "defer") {
    return "w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 disabled:opacity-50";
  }

  return "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50";
}

function actionSuccessMessage(actionType: string) {
  if (actionType === "present_proposal") return "Proposal delivered; new attention created from the outcome.";
  if (actionType === "request_changes") return "Change request captured as new attention.";
  if (actionType === "activate") return "Customer activated; kickoff attention created from the outcome.";
  if (actionType === "request_information") return "Information request captured as new attention.";
  return "Decision deferred for follow-up.";
}

export function DecisionInbox() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const db = useMemo(() => {
    const refreshGeneration = refreshToken;
    return createFeltDB({
      namespace: "id8-poc-client",
      server: { url: "/api/feltdb", requestTimeoutMs: 30_000 + refreshGeneration * 0 },
    });
  }, [refreshToken]);

  const collections = useMemo(
    () => ({
      people: db.collection<Person>("people"),
      organizations: db.collection<Organization>("organizations"),
      interactions: db.collection<Interaction>("interactions"),
      attentions: db.collection<Attention>("attentions"),
      intents: db.collection<Intent>("intents"),
      plans: db.collection<Plan>("plans"),
      requirements: db.collection<Requirement>("requirements"),
      work: db.collection<WorkItem>("work"),
      evidence: db.collection<Evidence>("evidence"),
      evaluations: db.collection<Evaluation>("evaluations"),
      decisions: db.collection<Decision>("decisions"),
      outcomes: db.collection<Outcome>("outcomes"),
      actions: db.collection<ActionRecord>("actions"),
      artifacts: db.collection<Artifact>("artifacts"),
      agents: db.collection<AgentRecord>("agents"),
      events: db.collection<DomainEvent>("events"),
    }),
    [db],
  );

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      setLoading(true);
      setError(null);

      try {
        const [
          people,
          organizations,
          interactions,
          attentions,
          intents,
          plans,
          requirements,
          work,
          evidence,
          evaluations,
          decisions,
          outcomes,
          actions,
          artifacts,
          agents,
          events,
        ] = await Promise.all([
          collections.people.all(),
          collections.organizations.all(),
          collections.interactions.all(),
          collections.attentions.all(),
          collections.intents.all(),
          collections.plans.all(),
          collections.requirements.all(),
          collections.work.all(),
          collections.evidence.all(),
          collections.evaluations.all(),
          collections.decisions.all(),
          collections.outcomes.all(),
          collections.actions.all(),
          collections.artifacts.all(),
          collections.agents.all(),
          collections.events.all(),
        ]);

        if (!active) {
          return;
        }

        setSnapshot({
          people,
          organizations,
          interactions,
          attentions,
          intents,
          plans,
          requirements,
          work,
          evidence,
          evaluations,
          decisions,
          outcomes,
          actions,
          artifacts,
          agents,
          events,
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      active = false;
    };
  }, [collections]);

  const model = useMemo(() => {
    const peopleById = new Map(snapshot.people.map((item) => [item.id, item]));
    const organizationsById = new Map(snapshot.organizations.map((item) => [item.id, item]));
    const intentsById = new Map(snapshot.intents.map((item) => [item.id, item]));
    const latestEvaluations = new Map<string, Evaluation>();

    for (const evaluation of [...snapshot.evaluations].sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt))) {
      latestEvaluations.set(evaluation.planId, evaluation);
    }

    const planCards = snapshot.plans.map((plan) => {
      const planRequirements = snapshot.requirements.filter((item) => item.planId === plan.id);
      const planEvidence = snapshot.evidence.filter((item) => item.planId === plan.id);
      const planWork = snapshot.work.filter((item) => item.planId === plan.id);
      const planDecision = snapshot.decisions.find((item) => item.planId === plan.id);
      const planIntent = intentsById.get(plan.intentId);
      const planInteractions = snapshot.interactions.filter((item) => item.situationId === plan.situationId);
      const planAttentions = snapshot.attentions.filter((item) => item.situationId === plan.situationId);
      const latestAttention = [...planAttentions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
      const relatedPerson = latestAttention?.personId ? peopleById.get(latestAttention.personId) : undefined;
      const relatedOrganization = latestAttention?.organizationId ? organizationsById.get(latestAttention.organizationId) : relatedPerson ? organizationsById.get(relatedPerson.organizationId) : undefined;
      const latestEvaluation = latestEvaluations.get(plan.id);
      const totalPremium = planEvidence.reduce((sum, item) => sum + (typeof item.value.annualPremium === "number" ? item.value.annualPremium : 0), 0);

      return {
        plan,
        planRequirements,
        planEvidence,
        planWork,
        planDecision,
        planIntent,
        planInteractions,
        latestAttention,
        relatedPerson,
        relatedOrganization,
        latestEvaluation,
        totalPremium,
      };
    });

    return {
      readyDecisions: planCards.filter((card) => card.planDecision?.status === "ready"),
      activePlans: planCards.filter((card) => card.latestEvaluation?.status === "not_ready"),
      recentEvents: [...snapshot.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
      actions: [...snapshot.actions].sort((a, b) => b.executedAt.localeCompare(a.executedAt)),
      artifacts: new Map(snapshot.artifacts.map((item) => [item.id, item])),
      agents: new Map(snapshot.agents.map((item) => [item.id, item])),
      outcomes: snapshot.outcomes,
    };
  }, [snapshot]);

  async function postJson(url: string, body: Record<string, unknown>, busyId: string, successMessage: string) {
    setBusyKey(busyId);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Request failed with ${response.status}`);
      }

      setMessage(successMessage);
      setRefreshToken((current) => current + 1);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading durable decision state…</div>;
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Badge tone="blue">ID8 turns events into decision-ready situations</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Decision Readiness Engine POC</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            This Next.js showcase uses FeltDB’s durable Node file runtime on the server and a FeltDB client in the browser. The engine stores the full lifecycle — attention, context, intent, plan, work, evidence, evaluation, decision, action, and outcome — and only surfaces situations whose evidence is actually decision-ready.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {["ATTENTION", "CONTEXT", "INTENT", "PLAN", "WORK", "EVIDENCE", "EVALUATION", "DECISION", "ACTION", "OUTCOME"].map((step) => (
              <span key={step} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium">
                {step}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 p-6 text-sm text-slate-100">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Architectural invariant</div>
          <div className="mt-4 space-y-2 font-mono text-xs">
            {["HUMAN", "DECISION", "EVALUATION", "EVIDENCE", "WORK", "PLAN", "INTENT", "CONTEXT", "ATTENTION"].map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-300">Work completion does not make a situation ready. Only the evidence required by the active plan can do that.</p>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Decision inbox</p>
            <h2 className="text-2xl font-semibold text-slate-950">Humans see only ready decisions by default</h2>
          </div>
          <Badge tone="emerald">{model.readyDecisions.length} ready</Badge>
        </div>

        <div className="space-y-6">
          {model.readyDecisions.map((card) => (
            <article key={card.plan.id} className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-semibold text-slate-950">{card.relatedOrganization?.name}</h3>
                    <Badge tone="emerald">READY</Badge>
                    <Badge tone="blue">{card.plan.domain}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{card.planDecision?.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{card.planIntent?.description}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total premium</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{currency.format(card.totalPremium)}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Context</div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div>{card.relatedPerson?.name} · {card.relatedPerson?.title}</div>
                    <div>{card.relatedOrganization?.industry} · {card.relatedOrganization?.location}</div>
                    <div>{card.planInteractions.length} prior interactions resolved automatically</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {card.relatedOrganization?.facts.map((fact) => (
                      <FactPill key={`${card.relatedOrganization?.id}-${fact.label}`} {...fact} />
                    ))}
                    {card.relatedPerson?.facts.map((fact) => (
                      <FactPill key={`${card.relatedPerson?.id}-${fact.label}`} {...fact} />
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Evidence</div>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {card.planRequirements.map((requirement) => {
                      const linkedEvidence = card.planEvidence.filter((item) => item.requirementId === requirement.id);
                      const linkedArtifact = linkedEvidence[0]?.artifactId ? model.artifacts.get(linkedEvidence[0].artifactId) : undefined;
                      return (
                        <li key={requirement.id} className="rounded-2xl border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-900">{requirement.description}</span>
                            <Badge tone={linkedEvidence.length > 0 ? "emerald" : "amber"}>{linkedEvidence.length > 0 ? "Satisfied" : "Missing"}</Badge>
                          </div>
                          {linkedEvidence[0] ? (
                            <div className="mt-2 text-xs text-slate-500">
                              {linkedEvidence[0].source} · {linkedEvidence[0].provenance}
                              {linkedArtifact ? ` · artifact: ${linkedArtifact.name}` : ""}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Available actions</div>
                  <p className="text-sm text-slate-600">{card.latestEvaluation?.rationale}</p>
                  <div className="space-y-2">
                    {card.planDecision?.availableActions.map((actionType) => {
                      const actionKey = `decision:${card.planDecision?.id}:${actionType}`;
                      const busy = busyKey === actionKey;
                      return (
                        <button
                          key={actionType}
                          type="button"
                          onClick={() =>
                            postJson(
                              `/api/decisions/${card.planDecision?.id}`,
                              { actionType },
                              actionKey,
                              actionSuccessMessage(actionType),
                            )
                          }
                          disabled={busy}
                          className={actionButtonClass(actionType)}
                        >
                          {busy ? "Working…" : actionLabels[actionType] ?? actionType}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          ))}

          {model.readyDecisions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No situations are currently decision-ready.</div> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Engine workbench</p>
            <h2 className="text-2xl font-semibold text-slate-950">Non-ready situations keep gathering evidence</h2>
          </div>
          <Badge tone="amber">{model.activePlans.length} active</Badge>
        </div>
        <div className="space-y-6">
          {model.activePlans.map((card) => (
            <article key={card.plan.id} className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-semibold text-slate-950">{card.relatedOrganization?.name}</h3>
                    <Badge tone="amber">NOT READY</Badge>
                    <Badge tone="blue">{card.plan.domain}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{card.plan.objective}</p>
                  <p className="mt-1 text-sm text-slate-600">{card.latestEvaluation?.rationale}</p>
                </div>
                <button
                  type="button"
                  onClick={() => postJson(`/api/plans/${card.plan.id}/fulfill`, {}, `plan:${card.plan.id}:fulfill`, "Missing evidence collected; evaluation rebuilt from durable state.")}
                  disabled={busyKey === `plan:${card.plan.id}:fulfill`}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyKey === `plan:${card.plan.id}:fulfill` ? "Collecting…" : "Simulate Evidence Arrival"}
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Missing requirements</div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {card.planRequirements.filter((item) => !item.satisfied).map((item) => (
                      <li key={item.id} className="rounded-2xl border border-slate-200 px-3 py-2">
                        <div className="font-medium text-slate-900">{item.description}</div>
                        <div className="mt-1 text-xs text-slate-500">Work template: {item.workTitle}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Open work</div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {card.planWork.filter((item) => item.status !== "completed").map((item) => (
                      <li key={item.id} className="rounded-2xl border border-slate-200 px-3 py-2">
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{model.agents.get(item.performerId ?? "")?.name ?? item.performerType} · {item.status}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Resolved context</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div>{card.relatedPerson?.name} · {card.relatedPerson?.title}</div>
                    <div>{card.relatedOrganization?.industry} · {card.relatedOrganization?.location}</div>
                    <div>{card.planInteractions.length} prior interactions reused before new work was requested</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.relatedOrganization?.facts.map((fact) => (
                      <FactPill key={`${card.relatedOrganization?.id}-${fact.label}`} {...fact} />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Continuity</p>
              <h2 className="text-2xl font-semibold text-slate-950">Actions and outcomes stay durable</h2>
            </div>
            <Badge tone="slate">{model.actions.length} actions</Badge>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            {model.actions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4">Make a decision above to produce an action and outcome.</div>
            ) : (
              model.actions.map((action) => {
                const outcome = model.outcomes.find((item) => item.actionId === action.id);
                return (
                  <div key={action.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900">{action.type.replaceAll("_", " ")}</div>
                      <Badge tone="emerald">{action.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(action.executedAt).toLocaleString()}</div>
                    <div className="mt-2">{outcome?.summary ?? "Outcome pending"}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Audit trail</p>
              <h2 className="text-2xl font-semibold text-slate-950">Lifecycle events</h2>
            </div>
            <Badge tone="slate">{model.recentEvents.length} recent</Badge>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            {model.recentEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={event.type.includes("ready") || event.type.includes("completed") ? "emerald" : event.type.includes("created") ? "blue" : "slate"}>{event.type}</Badge>
                  <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 font-medium text-slate-900">{event.summary}</div>
                <div className="mt-1 text-xs text-slate-500">{event.actor}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
