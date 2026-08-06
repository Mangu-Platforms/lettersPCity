/**
 * GENOME STORE
 * Persistence layer for the Product Genome.
 * Currently: in-memory with file-based backup.
 * Future: PostgreSQL + Redis for scalability.
 */

import fs from "fs/promises";
import path from "path";
import { GenomeNode, GenomeRelationship, Genome, GenomeSchema } from "./genome.schema";
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
    try {
      const data = await fs.readFile(this.persistencePath, "utf-8");
      const loaded = JSON.parse(data);
      this.genome = GenomeSchema.parse(loaded);
      console.log(`[Genome] Loaded existing genome from ${this.persistencePath}`);
    } catch (err) {
      console.log(`[Genome] Starting with empty genome (file not found or invalid)`);
      await this.save();
    }
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
    const nodeType = node.type as keyof Omit<Genome, "relationships">;

    // Handle vision specially (it's optional, not an array)
    if (nodeType === "vision") {
      (this.genome as any)[nodeType] = node;
      console.log(`[Genome] Created ${node.type} node: ${node.id}`);
      await this.save();
      return node;
    }

    // All other types are arrays
    const collection = (this.genome[nodeType] as any[]) || [];
    const idx = collection.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      collection[idx] = node;
      console.log(`[Genome] Updated ${node.type} node: ${node.id}`);
    } else {
      collection.push(node);
      console.log(`[Genome] Created ${node.type} node: ${node.id}`);
    }

    (this.genome[nodeType] as any) = collection;
    await this.save();
    return node;
  }

  /**
   * Query nodes by type.
   */
  getNodesByType(type: GenomeNode["type"]): GenomeNode[] {
    return (this.genome[type as keyof Omit<Genome, "relationships">] as any[]) || [];
  }

  /**
   * Get a single node by ID.
   */
  getNode(id: string): GenomeNode | undefined {
    const types = [
      "vision",
      "goals",
      "features",
      "requirements",
      "components",
      "services",
      "databases",
      "apis",
      "tests",
      "deployments",
      "research",
      "decisions",
      "risks",
    ] as const;

    for (const type of types) {
      const collection = this.genome[type] as any[];
      const found = collection.find((n) => n.id === id);
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
