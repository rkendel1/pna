import { NextRequest } from "next/server";
import { getServerDb } from "@/lib/feltdb";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "revision") {
    const sync = await db.sync();
    return json({ revision: sync.sequence, scope: sync.instance_id });
  }

  if (path[0] === "collections" && path[1]) {
    const collection = db.collection<Record<string, unknown>>(path[1]);

    if (path[2]) {
      const item = await collection.get(path[2]);
      if (!item) {
        return json({ error: "Not found" }, { status: 404 });
      }
      return json({ value: item });
    }

    const items = await collection.all();
    return json(items.map((value) => ({ value })));
  }

  return json({ error: "Unsupported GET endpoint" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  await request.text();
  await context.params;
  return json({ error: "The generic FeltDB endpoint is read-only in this POC." }, { status: 403 });
}

export async function PATCH() {
  return json({ error: "The generic FeltDB endpoint is read-only in this POC." }, { status: 403 });
}

export async function DELETE() {
  return json({ error: "The generic FeltDB endpoint is read-only in this POC." }, { status: 403 });
}
