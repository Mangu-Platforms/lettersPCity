/**
 * AGENT FRAMEWORK
 * Base class for all Forge agents.
 * Enforces: constitution checks, citation requirements, genome writes, reasoning loops.
 */

import { GenomeStore } from "./genome-store";
import { ConstitutionValidator, Decision } from "./constitution";
import { GenomeNode } from "./genome.schema";
import { v4 as uuidv4 } from "uuid";

export interface AgentConfig {
  id: string;
  name: string;
  layer: "research" | "product" | "architecture" | "builder" | "adversarial";
  capabilities: string[]; // e.g., ["web_research", "competitive_analysis", "code_generation"]
}

export interface AgentOutput {
  agentId: string;
  agentName: string;
  timestamp: Date;
  reasoning: string;
  citations: string[]; // links to genome nodes or external sources
  genomeWrites: GenomeNode[]; // nodes created/updated by this agent
  artifacts?: Record<string, any>; // generated code, docs, diagrams, etc.
}

export abstract class ForgeAgent {
  protected config: AgentConfig;
  protected genomeStore: GenomeStore;
  protected constitutionValidator: ConstitutionValidator;
  protected logger: Console;

  constructor(config: AgentConfig, genomeStore: GenomeStore) {
    this.config = config;
    this.genomeStore = genomeStore;
    this.constitutionValidator = new ConstitutionValidator();
    this.logger = console;
  }

  /**
   * Main agent loop: reason → validate → write to genome.
   * Subclasses implement the reasoning step.
   */
  async execute(): Promise<AgentOutput> {
    this.logger.log(`\n[${this.config.name}] Starting execution...`);

    // Step 1: Reason (subclass implements this)
    const reasoning = await this.reason();
    const citations = await this.getCitations();

    // Step 2: Generate genome nodes
    const genomeWrites = await this.generateGenomeWrites(reasoning, citations);

    // Step 3: Validate against constitution
    for (const node of genomeWrites) {
      const decision: Decision = {
        id: uuidv4(),
        reasoning,
        source: "requirement", // default; subclass can override
        sourceId: node.id,
        timestamp: new Date(),
        agentId: this.config.id,
      };

      const validation = this.constitutionValidator.validate(decision);
      if (!validation.passed) {
        this.logger.error(`[${this.config.name}] Constitution validation failed:`);
        validation.violations.forEach((v) => this.logger.error(`  - ${v}`));
        throw new Error(`Constitution violation in agent ${this.config.name}`);
      }
    }

    // Step 4: Write to genome
    for (const node of genomeWrites) {
      await this.genomeStore.upsertNode(node);
    }

    // Step 5: Generate artifacts
    const artifacts = await this.generateArtifacts(genomeWrites);

    const output: AgentOutput = {
      agentId: this.config.id,
      agentName: this.config.name,
      timestamp: new Date(),
      reasoning,
      citations,
      genomeWrites,
      artifacts,
    };

    this.logger.log(`[${this.config.name}] Completed. Wrote ${genomeWrites.length} nodes.`);
    return output;
  }

  /**
   * REASONING STEP
   * Subclass implements this: analyze data, make decisions, produce insights.
   * Must return clear explanation of reasoning.
   */
  protected abstract reason(): Promise<string>;

  /**
   * GET CITATIONS
   * Subclass implements this: list sources for the reasoning.
   * Can cite genome nodes, research findings, founder beliefs, requirements.
   */
  protected abstract getCitations(): Promise<string[]>;

  /**
   * GENERATE GENOME WRITES
   * Subclass implements this: create genome nodes based on reasoning.
   */
  protected abstract generateGenomeWrites(reasoning: string, citations: string[]): Promise<GenomeNode[]>;

  /**
   * GENERATE ARTIFACTS
   * Optional: create code, docs, diagrams, configs, etc.
   */
  protected async generateArtifacts(nodes: GenomeNode[]): Promise<Record<string, any>> {
    // Default: no artifacts. Subclass can override.
    return {};
  }

  /**
   * Helper: log a message prefixed with agent name.
   */
  protected log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const prefix = `[${this.config.name}]`;
    if (level === "error") {
      this.logger.error(`${prefix} ${message}`);
    } else if (level === "warn") {
      this.logger.warn(`${prefix} ${message}`);
    } else {
      this.logger.log(`${prefix} ${message}`);
    }
  }

  /**
   * Helper: assert a condition, throw if false.
   */
  protected assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`[${this.config.name}] Assertion failed: ${message}`);
    }
  }
}

/**
 * Example: Simple agent that adds a genome node without complex reasoning.
 */
export class SimpleGenomeAgentExample extends ForgeAgent {
  private nodeToAdd: GenomeNode;

  constructor(
    config: AgentConfig,
    genomeStore: GenomeStore,
    nodeToAdd: GenomeNode
  ) {
    super(config, genomeStore);
    this.nodeToAdd = nodeToAdd;
  }

  protected async reason(): Promise<string> {
    return `Agent ${this.config.name} is adding a ${this.nodeToAdd.type} node: ${
      (this.nodeToAdd as any).title || (this.nodeToAdd as any).name || "unnamed"
    }`;
  }

  protected async getCitations(): Promise<string[]> {
    return ["manual_input"]; // internal citation
  }

  protected async generateGenomeWrites(): Promise<GenomeNode[]> {
    return [this.nodeToAdd];
  }
}
