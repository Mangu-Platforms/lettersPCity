/**
 * GENOME STORE
 * Persistence layer for the Product Genome.
 * Currently: in-memory with file-based backup.
 * Future: PostgreSQL + Redis for scalability.
 */

import fs from "fs/promises";
import path from "path";
import {
  GenomeNode,
  GenomeRelationship,
  Genome,
  GenomeSchema,
  GenomeNodeSchema,
  COLLECTION_KEYS,
  collectionForType,
} from "./genome.schema";
import { v4 as uuidv4 } from "uuid";

export class GenomeStore {
  private genome: Genome;
  private persistencePath: string;

  constructor(persistencePath = "./genome.json") {
    this.persistencePath = persistencePath;
    this.genome = {
      goals: [],
      features: [],
      requirements: [],
      components: [],
      services: [],
      databases: [],
      apis: [],
      tests: [],
      deployments: [],
      research: [],
      decisions: [],
      risks: [],
      relationships: [],
    };
  }

  /**
   * Initialize the store: load from disk if exists, otherwise create new.
   */
  async initialize(): Promise<void> {
    let data: string;
    try {
      data = await fs.readFile(this.persistencePath, "utf-8");
    } catch {
      // No genome on disk yet -- a genuinely fresh start.
      console.log(`[Genome] No genome at ${this.persistencePath}; starting empty`);
      await this.save();
      return;
    }

    // The file exists. If it will not parse, that is a bug or a corrupted write --
    // NOT a cue to silently replace it with an empty genome. Doing that is how three
    // sessions of research findings were destroyed on reload.
    const parsed = GenomeSchema.safeParse(JSON.parse(data));
    if (!parsed.success) {
      throw new Error(
        `[Genome] ${this.persistencePath} exists but does not match GenomeSchema. ` +
          `Refusing to overwrite it. First issues: ` +
          JSON.stringify(parsed.error.issues.slice(0, 5), null, 2)
      );
    }

    this.genome = parsed.data;
    console.log(
      `[Genome] Loaded ${this.count()} nodes from ${this.persistencePath}`
    );
  }

  /** Total node count across every collection, plus vision. */
  count(): number {
    const inCollections = COLLECTION_KEYS.reduce(
      (sum, key) => sum + (this.genome[key]?.length ?? 0),
      0
    );
    return inCollections + (this.genome.vision ? 1 : 0);
  }

  /**
   * Persist genome to disk.
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.persistencePath, JSON.stringify(this.genome, null, 2));
    } catch (err) {
      console.error(`[Genome] Failed to save: ${err}`);
      throw err;
    }
  }

  /**
   * Add or update a genome node.
   */
  async upsertNode(node: GenomeNode): Promise<GenomeNode> {
    // Validate on write. Without this, a malformed node is accepted silently and
    // only surfaces later as an unreadable genome -- which is how a bad `source`
    // enum value sat in the requirements collection undetected.
    const validated = GenomeNodeSchema.safeParse(node);
    if (!validated.success) {
      throw new Error(
        `[Genome] Refusing to write invalid ${node.type} node ${node.id}: ` +
          JSON.stringify(validated.error.issues.slice(0, 3), null, 2)
      );
    }
    node = validated.data;

    // node.type is singular ("goal"); the collection holding it is plural ("goals").
    const key = collectionForType(node.type);

    // Vision is a single optional node, not a collection.
    if (key === null) {
      (this.genome as any).vision = node;
      console.log(`[Genome] Created ${node.type} node: ${node.id}`);
      await this.save();
      return node;
    }

    const collection = (this.genome[key] as any[]) ?? [];
    const idx = collection.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      collection[idx] = node;
      console.log(`[Genome] Updated ${node.type} node: ${node.id}`);
    } else {
      collection.push(node);
      console.log(`[Genome] Created ${node.type} node: ${node.id}`);
    }

    (this.genome[key] as any) = collection;
    await this.save();
    return node;
  }

  /**
   * Query nodes by type.
   */
  getNodesByType(type: GenomeNode["type"]): GenomeNode[] {
    const key = collectionForType(type);
    if (key === null) return this.genome.vision ? [this.genome.vision] : [];
    return (this.genome[key] as any[]) ?? [];
  }

  /**
   * Get a single node by ID.
   */
  getNode(id: string): GenomeNode | undefined {
    // Vision is a scalar -- checked directly, not iterated as a collection.
    if (this.genome.vision?.id === id) return this.genome.vision;

    for (const key of COLLECTION_KEYS) {
      const found = (this.genome[key] as any[])?.find((n) => n.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Add a relationship between two nodes.
   */
  async createRelationship(
    fromNodeId: string,
    toNodeId: string,
    relationType: string
  ): Promise<GenomeRelationship> {
    const fromNode = this.getNode(fromNodeId);
    const toNode = this.getNode(toNodeId);

    if (!fromNode || !toNode) {
      throw new Error(
        `Cannot create relationship: source (${fromNodeId}) or target (${toNodeId}) not found`
      );
    }

    const rel: GenomeRelationship = {
      id: uuidv4(),
      fromNodeId,
      fromType: fromNode.type,
      toNodeId,
      toType: toNode.type,
      relationType,
      createdAt: new Date(),
    };

    this.genome.relationships.push(rel);
    await this.save();
    console.log(
      `[Genome] Created relationship: ${fromNode.type}(${fromNodeId}) --${relationType}--> ${toNode.type}(${toNodeId})`
    );
    return rel;
  }

  /**
   * Query relationships.
   */
  getRelationships(fromNodeId?: string, toNodeId?: string): GenomeRelationship[] {
    return this.genome.relationships.filter((r) => {
      if (fromNodeId && r.fromNodeId !== fromNodeId) return false;
      if (toNodeId && r.toNodeId !== toNodeId) return false;
      return true;
    });
  }

  /**
   * Get all nodes that depend on a given node.
   */
  getDependents(nodeId: string): GenomeNode[] {
    const relationships = this.genome.relationships.filter((r) => r.toNodeId === nodeId);
    return relationships
      .map((r) => this.getNode(r.fromNodeId))
      .filter((n) => n !== undefined) as GenomeNode[];
  }

  /**
   * Get all nodes that a given node depends on.
   */
  getDependencies(nodeId: string): GenomeNode[] {
    const relationships = this.genome.relationships.filter((r) => r.fromNodeId === nodeId);
    return relationships
      .map((r) => this.getNode(r.toNodeId))
      .filter((n) => n !== undefined) as GenomeNode[];
  }

  /**
   * Get full genome state.
   */
  getGenome(): Genome {
    return JSON.parse(JSON.stringify(this.genome));
  }

  /**
   * Export genome to JSON (for analysis/visualization).
   */
  async exportToJSON(filepath: string): Promise<void> {
    await fs.writeFile(filepath, JSON.stringify(this.genome, null, 2));
    console.log(`[Genome] Exported to ${filepath}`);
  }

  /**
   * Clear genome (for testing).
   */
  async clear(): Promise<void> {
    this.genome = {
      vision: undefined,
      goals: [],
      features: [],
      requirements: [],
      components: [],
      services: [],
      databases: [],
      apis: [],
      tests: [],
      deployments: [],
      research: [],
      decisions: [],
      risks: [],
      relationships: [],
    };
    await this.save();
  }
}

// Singleton instance
let store: GenomeStore | null = null;

/**
 * Get or initialize the global genome store.
 */
export async function getGenomeStore(): Promise<GenomeStore> {
  if (!store) {
    store = new GenomeStore();
    await store.initialize();
  }
  return store;
}
