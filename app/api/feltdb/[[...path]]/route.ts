import { NextRequest } from "next/server";
import { authorizeDemoMutation, authorizeSameOriginRequest } from "@/lib/demo-auth";
import { getServerDb } from "@/lib/feltdb";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

type QueryBody = {
  collection: string;
  where?: Array<{ field: string; eq?: unknown }>;
  limit?: number;
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

const exposedCollections = new Set([
  "people",
  "organizations",
  "interactions",
  "attentions",
  "intents",
  "plans",
  "requirements",
  "work",
  "evidence",
  "evaluations",
  "decisions",
  "artifacts",
  "agents",
]);

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "revision") {
    const sync = await db.sync();
    return json({ revision: sync.sequence, scope: sync.instance_id });
  }

  if (path[0] === "collections" && path[1]) {
    if (!exposedCollections.has(path[1])) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }

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
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "query") {
    const authError = authorizeSameOriginRequest(request);
    if (authError) {
      return json({ error: authError }, { status: 403 });
    }
    const body = (await request.json()) as QueryBody;
    if (!exposedCollections.has(body.collection)) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }
    const collection = db.collection<Record<string, unknown>>(body.collection);
    const filters = Object.fromEntries((body.where ?? []).map((condition) => [condition.field, condition.eq]));
    const items = await collection.find(filters);
    const limit = body.limit ?? items.length;
    const records = items.slice(0, limit);
    return json({
      records,
      exhausted: items.length <= limit,
    });
  }

  const authError = authorizeDemoMutation(request);
  if (authError) {
    return json({ error: authError }, { status: 403 });
  }

  if (path[0] === "collections" && path[1] && !path[2]) {
    if (!exposedCollections.has(path[1])) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }
    const collection = db.collection<Record<string, unknown>>(path[1]);
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) {
      return json({ error: "Record must include id" }, { status: 400 });
    }
    await collection.insert(body, id);
    return json({ id, value: body }, { status: 201 });
  }

  if (path[0] === "collections" && path[1] && path[2] && path[3] === "cas") {
    if (!exposedCollections.has(path[1])) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }
    const collection = db.collection<Record<string, unknown>>(path[1]);
    const body = (await request.json()) as { expectedVersion?: number; value?: Record<string, unknown> };
    if (body.expectedVersion === undefined || !body.value) {
      return json({ error: "expectedVersion and value are required" }, { status: 400 });
    }
    const result = await collection.updateIfVersion(path[2], body.expectedVersion, body.value);
    if (!result.updated) {
      return json({ code: "VERSION_CONFLICT", currentVersion: result.currentVersion }, { status: 409 });
    }
    return json({ updated: true, currentVersion: result.item?.__version, item: result.item });
  }

  return json({ error: "Unsupported POST endpoint" }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = authorizeDemoMutation(request);
  if (authError) {
    return json({ error: authError }, { status: 403 });
  }

  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "collections" && path[1] && path[2]) {
    if (!exposedCollections.has(path[1])) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }
    const collection = db.collection<Record<string, unknown>>(path[1]);
    const body = (await request.json()) as { expectedVersion?: number; value?: Record<string, unknown> };
    if (body.expectedVersion === undefined || !body.value) {
      return json({ error: "expectedVersion and value are required; use compare-and-set semantics." }, { status: 400 });
    }
    const result = await collection.updateIfVersion(path[2], body.expectedVersion, body.value);
    if (!result.updated) {
      return json({ code: "VERSION_CONFLICT", currentVersion: result.currentVersion }, { status: 409 });
    }
    return json({ value: result.item });
  }

  return json({ error: "Unsupported PATCH endpoint" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authError = authorizeDemoMutation(request);
  if (authError) {
    return json({ error: authError }, { status: 403 });
  }

  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "collections" && path[1] && path[2]) {
    if (!exposedCollections.has(path[1])) {
      return json({ error: "Collection is not exposed by this demo API." }, { status: 404 });
    }
    const collection = db.collection<Record<string, unknown>>(path[1]);
    await collection.delete(path[2]);
    return new Response(null, { status: 204 });
  }

  return json({ error: "Unsupported DELETE endpoint" }, { status: 404 });
}
