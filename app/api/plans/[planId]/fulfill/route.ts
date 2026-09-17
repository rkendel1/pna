import { getServerDb } from "@/lib/feltdb";
import { completeMissingRequirements } from "@/lib/id8-engine";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { planId } = await context.params;

  try {
    const db = await getServerDb();
    await completeMissingRequirements(db, planId, "agent:readiness-worker");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
