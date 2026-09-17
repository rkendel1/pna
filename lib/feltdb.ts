import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createFeltDB, getTelemetryClient, type StateFirstDB } from "@feltdb/core";
import { ensureSeedData } from "@/lib/id8-engine";

declare global {
  var __id8DbPromise: Promise<StateFirstDB> | undefined;
}

const dbPath = path.join(process.cwd(), ".feltdb", "id8-poc");

getTelemetryClient().disable();

async function createDatabase() {
  await mkdir(dbPath, { recursive: true });
  const db = createFeltDB({ namespace: "id8-poc", path: dbPath });
  await ensureSeedData(db);
  return db;
}

export function getServerDb() {
  globalThis.__id8DbPromise ??= createDatabase();
  return globalThis.__id8DbPromise;
}
