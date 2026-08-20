/**
 * Round-trip tests for GenomeStore.
 *
 * These exist because two bugs survived three build sessions unnoticed:
 *   1. Nodes were written to `genome[node.type]` -- singular ("goal") -- while the
 *      schema defines plural collections ("goals"), so every write landed in a key
 *      the schema does not define and read back as empty.
 *   2. `createdAt`/`updatedAt` were `z.date()`, which cannot parse the ISO strings
 *      that JSON.stringify produces. Every reload therefore failed to parse, and
 *      initialize() swallowed the error and started from an empty genome --
 *      silently destroying whatever was on disk.
 *
 * The assertion that matters is: write a node, reload from disk, read it back.
 */

import fs from "fs/promises";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { GenomeStore } from "../../src/forge/genome-store";
import {
  GenomeSchema,
  GenomeNode,
  COLLECTION_KEYS,
  collectionForType,
} from "../../src/forge/genome.schema";

let tmpDir: string;
let genomePath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "genome-test-"));
  genomePath = path.join(tmpDir, "genome.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const base = (createdBy = "test-agent") => ({
  id: uuidv4(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy,
  version: 1,
});

/** One valid node per type, so every collection is exercised. */
function sampleNodes(): GenomeNode[] {
  return [
    { ...base(), type: "vision", title: "V", content: "c", keyPrinciples: ["p"] },
    {
      ...base(),
      type: "goal",
      title: "G",
      description: "d",
      metrics: [{ name: "m", target: "t", measurementMethod: "mm" }],
      relatedVisionId: uuidv4(),
      priority: "p0",
    },
    {
      ...base(),
      type: "feature",
      name: "F",
      description: "d",
      userValue: "v",
      relatedGoalIds: [],
      status: "ideated",
      version: "v1", // FeatureNodeSchema overrides base `version` to a string
    },
    {
      ...base(),
      // RequirementNodeSchema overrides `id` with a REQ-\d+ pattern, not a uuid.
      id: "REQ-001",
      type: "requirement",
      title: "R",
      description: "d",
      source: "research",
      sourceId: uuidv4(),
      priority: "must",
      relatedFeatureIds: [],
      acceptanceCriteria: ["a"],
    },
    {
      ...base(),
      type: "research",
      category: "competitor",
      title: "Res",
      summary: "s",
      evidence: ["e"],
      implication: "i",
      relatedRequirementIds: [],
    },
    {
      ...base(),
      type: "decision",
      title: "D",
      context: "c",
      options: [{ name: "o", pros: ["p"], cons: ["c"] }],
      chosen: "o",
      reasoning: "r",
      tradeoffs: "t",
      relatedRequirementIds: [],
    },
  ] as unknown as GenomeNode[];
}

describe("GenomeStore round-trip", () => {
  it("persists each node type to its plural collection and reads it back after reload", async () => {
    const store = new GenomeStore(genomePath);
    await store.initialize();

    const nodes = sampleNodes();
    for (const node of nodes) await store.upsertNode(node);

    // Reload from disk with a fresh instance -- this is the step that used to
    // throw away everything.
    const reloaded = new GenomeStore(genomePath);
    await reloaded.initialize();

    for (const node of nodes) {
      const found = reloaded.getNode(node.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(node.id);
      expect(found!.type).toBe(node.type);

      // ...and it must live in the collection the schema actually defines.
      const key = collectionForType(node.type);
      if (key !== null) {
        const collection = reloaded.getNodesByType(node.type);
        expect(collection.map((n) => n.id)).toContain(node.id);
      }
    }
  });

  it("writes a file that GenomeSchema accepts, with no keys outside the schema", async () => {
    const store = new GenomeStore(genomePath);
    await store.initialize();
    for (const node of sampleNodes()) await store.upsertNode(node);

    const onDisk = JSON.parse(await fs.readFile(genomePath, "utf-8"));

    // Regression guard for bug 1: phantom singular keys must not appear.
    expect(Object.keys(onDisk)).not.toContain("goal");
    expect(Object.keys(onDisk)).not.toContain("feature");
    expect(Object.keys(onDisk)).not.toContain("requirement");
    expect(Object.keys(onDisk)).not.toContain("decision");

    // Regression guard for bug 2: the serialized form must parse back.
    const parsed = GenomeSchema.safeParse(onDisk);
    expect(parsed.success).toBe(true);
  });

  it("upserts by id rather than appending duplicates", async () => {
    const store = new GenomeStore(genomePath);
    await store.initialize();

    const goal = sampleNodes().find((n) => n.type === "goal")!;
    await store.upsertNode(goal);
    await store.upsertNode({ ...goal, title: "Renamed" } as GenomeNode);

    const goals = store.getNodesByType("goal");
    expect(goals).toHaveLength(1);
    expect((goals[0] as any).title).toBe("Renamed");
  });

  it("refuses to overwrite an existing genome that does not match the schema", async () => {
    await fs.writeFile(genomePath, JSON.stringify({ goals: "not-an-array" }));
    const store = new GenomeStore(genomePath);

    await expect(store.initialize()).rejects.toThrow(/does not match GenomeSchema/);

    // The bad file must still be there -- not silently replaced with an empty genome.
    const still = JSON.parse(await fs.readFile(genomePath, "utf-8"));
    expect(still.goals).toBe("not-an-array");
  });

  it("maps every node type to a collection the schema defines", () => {
    for (const key of COLLECTION_KEYS) {
      expect(GenomeSchema.shape).toHaveProperty(key);
    }
  });
});
