import { NextRequest } from "next/server";
import { authorizeDemoMutation } from "@/lib/demo-auth";
import { getServerDb } from "@/lib/feltdb";
import { makeDecision } from "@/lib/id8-engine";

type RouteContext = {
  params: Promise<{ decisionId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { decisionId } = await context.params;
  const authError = authorizeDemoMutation(request);

  if (authError) {
    return Response.json({ error: authError }, { status: 403 });
  }

  const body = (await request.json()) as { actionType?: string };
  if (!body.actionType) {
    return Response.json({ error: "actionType is required" }, { status: 400 });
  }

  try {
    const db = await getServerDb();
    const decision = await makeDecision(db, decisionId, body.actionType, "human:decision-inbox");
    return Response.json({ decision });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
