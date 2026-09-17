import { getServerDb } from "@/lib/feltdb";
import type { ActionRecord, DomainEvent, Outcome } from "@/lib/id8-types";

export async function GET() {
  const db = await getServerDb();
  const actions = (await db.collection<ActionRecord>("actions").all())
    .sort((left, right) => right.executedAt.localeCompare(left.executedAt))
    .slice(0, 8);
  const outcomes = (await db.collection<Outcome>("outcomes").all())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
  const events = (await db.collection<DomainEvent>("events").all())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 12);

  return Response.json({ actions, outcomes, events });
}
