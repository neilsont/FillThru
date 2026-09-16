import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import type {
  Generation,
  GenerationKind,
  GenerationRecord,
  GenerationUsage,
  NewGeneration,
} from "@/types/generation";

// Data-access layer for the MongoDB `generations` collection.
//
// MongoDB has no Row Level Security, so tenant isolation lives here instead:
// every function takes the caller's verified `userId` and every filter includes
// it. Nothing in this module trusts a document id on its own.

const COLLECTION = "generations";

async function collection(): Promise<Collection<Generation>> {
  const db = await getDb();
  return db.collection<Generation>(COLLECTION);
}

function toRecord(doc: WithId<Generation>): GenerationRecord {
  const { _id, createdAt, ...rest } = doc;
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString() } as GenerationRecord;
}

/**
 * Persist one AI output. Never throws — callers run this inside `after()` so a
 * MongoDB outage must not turn into a failed generation for the user.
 */
export async function recordGeneration(input: NewGeneration): Promise<void> {
  try {
    const col = await collection();
    await col.insertOne({ ...input, createdAt: new Date() } as Generation);
  } catch (error) {
    console.error("recordGeneration failed:", error);
  }
}

/** Batch variant for the extension's multi-question endpoint. */
export async function recordGenerations(inputs: NewGeneration[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const col = await collection();
    const createdAt = new Date();
    await col.insertMany(
      inputs.map((input) => ({ ...input, createdAt }) as Generation),
      { ordered: false }
    );
  } catch (error) {
    console.error("recordGenerations failed:", error);
  }
}

export interface ListGenerationsOptions {
  kind?: GenerationKind;
  /** Cursor: only return documents created strictly before this instant. */
  before?: Date;
  limit?: number;
}

/**
 * Newest-first history for one user. Uses `createdAt` as a cursor rather than
 * skip/limit so paging stays O(limit) as the collection grows — backed by the
 * `{ userId, kind, createdAt }` compound index.
 */
export async function listGenerations(
  userId: string,
  { kind, before, limit = 20 }: ListGenerationsOptions = {}
): Promise<GenerationRecord[]> {
  const col = await collection();
  const filter: Record<string, unknown> = { userId };
  if (kind) filter.kind = kind;
  if (before) filter.createdAt = { $lt: before };

  const docs = await col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();

  return docs.map(toRecord);
}

export async function getGeneration(
  userId: string,
  id: string
): Promise<GenerationRecord | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  return doc ? toRecord(doc) : null;
}

export async function deleteGeneration(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  const result = await col.deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount === 1;
}

/**
 * Usage rollup for one user since `since`. A single `$facet` pipeline computes
 * the per-kind and per-model counts in one round trip instead of N queries.
 */
export async function getGenerationUsage(
  userId: string,
  since: Date
): Promise<GenerationUsage> {
  const col = await collection();

  const [result] = await col
    .aggregate<{
      byKind: { _id: GenerationKind; count: number }[];
      byModel: { _id: string; count: number }[];
    }>([
      { $match: { userId, createdAt: { $gte: since } } },
      {
        $facet: {
          byKind: [{ $group: { _id: "$kind", count: { $sum: 1 } } }],
          byModel: [
            { $group: { _id: "$model", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ])
    .toArray();

  const byKind: GenerationUsage["byKind"] = {
    cover_letter: 0,
    question_answer: 0,
    field_mapping: 0,
  };
  for (const row of result?.byKind ?? []) {
    byKind[row._id] = row.count;
  }

  const byModel: Record<string, number> = {};
  for (const row of result?.byModel ?? []) {
    byModel[row._id] = row.count;
  }

  return {
    since: since.toISOString(),
    total: Object.values(byKind).reduce((sum, n) => sum + n, 0),
    byKind,
    byModel,
  };
}

/**
 * Idempotent index setup. Run via `npm run mongo:indexes` after provisioning
 * (createIndex is a no-op when the index already exists).
 */
export async function ensureGenerationIndexes(): Promise<string[]> {
  const col = await collection();
  return Promise.all([
    // History list: newest first per user.
    col.createIndex({ userId: 1, createdAt: -1 }, { name: "user_recent" }),
    // History list filtered by kind.
    col.createIndex({ userId: 1, kind: 1, createdAt: -1 }, { name: "user_kind_recent" }),
  ]);
}
