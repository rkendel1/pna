import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { getServerDb } from "@/lib/feltdb";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

type QueryBody = {
  collection: string;
  where?: Array<{ field: string; eq?: unknown; neq?: unknown; lt?: unknown; lte?: unknown; gt?: unknown; gte?: unknown }>;
  orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
  limit?: number;
  cursor?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function compare(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function matchesQuery(record: Record<string, unknown>, query: QueryBody["where"]) {
  return (query ?? []).every((condition) => {
    const value = record[condition.field];
    if (condition.eq !== undefined) return value === condition.eq;
    if (condition.neq !== undefined) return value !== condition.neq;
    if (condition.lt !== undefined) return compare(value, condition.lt) < 0;
    if (condition.lte !== undefined) return compare(value, condition.lte) <= 0;
    if (condition.gt !== undefined) return compare(value, condition.gt) > 0;
    if (condition.gte !== undefined) return compare(value, condition.gte) >= 0;
    return true;
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "revision") {
    const sync = db.sync();
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
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "query") {
    const body = (await request.json()) as QueryBody;
    const collection = db.collection<Record<string, unknown>>(body.collection);
    let items = (await collection.all()).filter((item) => matchesQuery(item, body.where));

    for (const rule of body.orderBy ?? []) {
      items = items.sort((left, right) => {
        const direction = rule.direction === "desc" ? -1 : 1;
        return compare(left[rule.field], right[rule.field]) * direction;
      });
    }

    const start = body.cursor ? Number(Buffer.from(body.cursor, "base64url").toString("utf8")) : 0;
    const limit = body.limit ?? items.length;
    const records = items.slice(start, start + limit);
    const nextOffset = start + limit;
    const nextCursor = nextOffset < items.length ? Buffer.from(String(nextOffset)).toString("base64url") : undefined;

    return json({ records, nextCursor, exhausted: !nextCursor });
  }

  if (path[0] === "collections" && path[1] && !path[2]) {
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
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "collections" && path[1] && path[2]) {
    const collection = db.collection<Record<string, unknown>>(path[1]);
    const body = (await request.json()) as Record<string, unknown>;
    await collection.update(path[2], body);
    const item = await collection.get(path[2]);
    return json({ value: item });
  }

  return json({ error: "Unsupported PATCH endpoint" }, { status: 404 });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const db = await getServerDb();

  if (path[0] === "collections" && path[1] && path[2]) {
    const collection = db.collection<Record<string, unknown>>(path[1]);
    await collection.delete(path[2]);
    return new Response(null, { status: 204 });
  }

  return json({ error: "Unsupported DELETE endpoint" }, { status: 404 });
}
