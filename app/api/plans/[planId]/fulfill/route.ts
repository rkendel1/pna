import { NextRequest } from "next/server";
import { authorizeDemoMutation } from "@/lib/demo-auth";
import { getServerDb } from "@/lib/feltdb";
import { completeMissingRequirements } from "@/lib/id8-engine";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { planId } = await context.params;
  const authError = authorizeDemoMutation(request);

  if (authError) {
    return Response.json({ error: authError }, { status: 403 });
  }

  try {
    const db = await getServerDb();
    await completeMissingRequirements(db, planId, "agent:readiness-worker");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
