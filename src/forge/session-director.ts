/**
 * SESSION DIRECTOR
 * Orchestrates the workflow: routes work, creates tasks, enforces constitution.
 * Controls the multi-session Phase 1 breakdown.
 */

import { ForgeAgent, AgentConfig, AgentOutput } from "./agent-framework";
import { GenomeStore } from "./genome-store";

export enum SessionPhase {
  "Scaffolding" = 1,
  "Research" = 2,
  "ProductDesign" = 3,
  "Architecture" = 4,
  "BackendBuild" = 5,
  "FrontendBuild" = 6,
  "Infrastructure" = 7,
  "Testing" = 8,
  "Documentation" = 9,
  "Refinement" = 10,
}

export interface Task {
  id: string;
  phase: SessionPhase;
  title: string;
  description: string;
  assignedAgents: string[];
  status: "pending" | "in_progress" | "completed" | "blocked";
  blockedReason?: string; // if status === "blocked", why?
  dependencies: string[]; // task IDs this depends on
  outputs: AgentOutput[];
  createdAt: Date;
  completedAt?: Date;
}

export class SessionDirector {
  private genomeStore: GenomeStore;
  private tasks: Map<string, Task> = new Map();
  private currentPhase: SessionPhase = SessionPhase.Scaffolding;
  private phaseAgents: Map<SessionPhase, ForgeAgent[]> = new Map();

  constructor(genomeStore: GenomeStore) {
    this.genomeStore = genomeStore;
  }

  /**
   * Initialize the session: set up Phase 1 task structure.
   */
  async initialize(): Promise<void> {
    console.log(`\n[SessionDirector] Initializing Phase 1: Forge Scaffolding`);

    // Create Phase 1 tasks
    const scaffoldingTasks: Task[] = [
      {
        id: "s1-constitution",
        phase: SessionPhase.Scaffolding,
        title: "Constitution Framework",
        description: "Implement the 10 laws as enforced code",
        assignedAgents: [],
        status: "completed", // already done
        dependencies: [],
        outputs: [],
        createdAt: new Date(),
        completedAt: new Date(),
      },
      {
        id: "s1-genome-schema",
        phase: SessionPhase.Scaffolding,
        title: "Product Genome Schema",
        description: "Define genome node types and relationships",
        assignedAgents: [],
        status: "completed", // already done
        dependencies: [],
        outputs: [],
        createdAt: new Date(),
        completedAt: new Date(),
      },
      {
        id: "s1-genome-store",
        phase: SessionPhase.Scaffolding,
        title: "Genome Persistence Layer",
        description: "Implement genome CRUD + querying",
        assignedAgents: [],
        status: "completed", // already done
        dependencies: [],
        outputs: [],
        createdAt: new Date(),
        completedAt: new Date(),
      },
      {
        id: "s1-agent-framework",
        phase: SessionPhase.Scaffolding,
        title: "Agent Framework",
        description: "Base class for all agents (reasoning, validation, genome writes)",
        assignedAgents: [],
        status: "completed", // already done
        dependencies: [],
        outputs: [],
        createdAt: new Date(),
        completedAt: new Date(),
      },
      {
        id: "s1-mcp-server",
        phase: SessionPhase.Scaffolding,
        title: "MCP Server",
        description: "REST API for genome CRUD + agent orchestration",
        assignedAgents: [],
        status: "pending",
        dependencies: ["s1-genome-store"],
        outputs: [],
        createdAt: new Date(),
      },
    ];

    for (const task of scaffoldingTasks) {
      this.tasks.set(task.id, task);
    }

    console.log(`[SessionDirector] Phase 1 initialized with ${scaffoldingTasks.length} tasks`);
  }

  /**
   * Register agents for a phase.
   */
  registerAgents(phase: SessionPhase, agents: ForgeAgent[]): void {
    this.phaseAgents.set(phase, agents);
    console.log(`[SessionDirector] Registered ${agents.length} agents for phase ${SessionPhase[phase]}`);
  }

  /**
   * Run all tasks in current phase, respecting dependencies.
   */
  async runPhase(): Promise<void> {
    console.log(`\n[SessionDirector] Running Phase ${SessionPhase[this.currentPhase]}`);

    const phaseTasks = Array.from(this.tasks.values()).filter((t) => t.phase === this.currentPhase);
    console.log(`[SessionDirector] Found ${phaseTasks.length} tasks for this phase`);

    // Topological sort by dependencies
    const sorted = this.topologicalSort(phaseTasks);

    for (const task of sorted) {
      if (task.status === "completed") {
        console.log(`[SessionDirector] Skipping completed task: ${task.title}`);
        continue;
      }

      // Check dependencies
      const blockingDeps = task.dependencies.filter((depId) => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status !== "completed";
      });

      if (blockingDeps.length > 0) {
        task.status = "blocked";
        task.blockedReason = `Waiting for: ${blockingDeps.join(", ")}`;
        console.log(`[SessionDirector] Task blocked: ${task.title} - ${task.blockedReason}`);
        continue;
      }

      // Run task
      await this.executeTask(task);
    }

    console.log(
      `[SessionDirector] Phase ${SessionPhase[this.currentPhase]} complete. Next phase: ${
        SessionPhase[this.currentPhase + 1] || "END"
      }`
    );
  }

  /**
   * Execute a single task.
   */
  private async executeTask(task: Task): Promise<void> {
    console.log(`\n[SessionDirector] Executing task: ${task.title}`);
    task.status = "in_progress";

    try {
      const agentsForTask = (this.phaseAgents.get(task.phase) || []).filter((a) =>
        task.assignedAgents.includes(a.constructor.name)
      );

      if (agentsForTask.length === 0) {
        console.log(
          `[SessionDirector] No agents assigned for task. Marking as pending for manual execution.`
        );
        task.status = "pending";
        return;
      }

      // Run agents (could be in parallel for independent tasks)
      for (const agent of agentsForTask) {
        const output = await agent.execute();
        task.outputs.push(output);
      }

      task.status = "completed";
      task.completedAt = new Date();
      console.log(`[SessionDirector] Task completed: ${task.title}`);
    } catch (err) {
      task.status = "blocked";
      task.blockedReason = `Error: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[SessionDirector] Task failed: ${task.title} - ${task.blockedReason}`);
    }
  }

  /**
   * Topological sort of tasks by dependencies.
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();

    const visit = (taskId: string, visiting = new Set<string>()): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) throw new Error(`Circular dependency detected: ${taskId}`);

      const task = this.tasks.get(taskId);
      if (!task) return;

      visiting.add(taskId);

      for (const depId of task.dependencies) {
        visit(depId, visiting);
      }

      visiting.delete(taskId);
      visited.add(taskId);
      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return sorted;
  }

  /**
   * Get summary of phase progress.
   */
  getSummary(): {
    phase: string;
    totalTasks: number;
    completed: number;
    pending: number;
    blocked: number;
    tasks: Task[];
  } {
    const phaseTasks = Array.from(this.tasks.values()).filter((t) => t.phase === this.currentPhase);
    const completed = phaseTasks.filter((t) => t.status === "completed").length;
    const pending = phaseTasks.filter((t) => t.status === "pending").length;
    const blocked = phaseTasks.filter((t) => t.status === "blocked").length;

    return {
      phase: SessionPhase[this.currentPhase],
      totalTasks: phaseTasks.length,
      completed,
      pending,
      blocked,
      tasks: phaseTasks,
    };
  }

  /**
   * Move to next phase.
   */
  advancePhase(): void {
    if (this.currentPhase < 10) {
      this.currentPhase++;
      console.log(`[SessionDirector] Advanced to Phase ${SessionPhase[this.currentPhase]}`);
    }
  }

  /**
   * Export session progress for review.
   */
  exportProgress(): object {
    return {
      currentPhase: SessionPhase[this.currentPhase],
      tasks: Array.from(this.tasks.values()),
      summary: this.getSummary(),
    };
  }
}
