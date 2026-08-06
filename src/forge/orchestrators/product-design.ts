/**
 * PRODUCT DESIGN ORCHESTRATOR
 * Session 3: PRD, Requirements, Prioritization
 * Synthesize research into actionable product specs
 */

import { getGenomeStore } from "../genome-store";
import { SessionDirector } from "../session-director";
import { PRDAgent } from "../agents/prd-agent";
import { RequirementsAgent } from "../agents/requirements-agent";
import { PrioritizationAgent } from "../agents/prioritization-agent";
import { AgentConfig } from "../agent-framework";

export async function runProductDesign(): Promise<void> {
  console.log("\n=== SESSION 3: PRODUCT DESIGN ===\n");

  // Initialize
  const store = await getGenomeStore();
  const director = new SessionDirector(store);
  await director.initialize();

  // Define agent configs
  const agentConfigs: AgentConfig[] = [
    {
      id: "prd-agent-001",
      name: "PRD Designer",
      layer: "product",
      capabilities: ["prd_synthesis", "goal_definition", "feature_identification"],
    },
    {
      id: "requirements-agent-001",
      name: "Requirements Engineer",
      layer: "product",
      capabilities: ["requirement_breakdown", "moscow_prioritization", "acceptance_criteria"],
    },
    {
      id: "prioritization-agent-001",
      name: "Roadmap Planner",
      layer: "product",
      capabilities: ["roadmap_creation", "phase_planning", "dependency_mapping"],
    },
  ];

  // Create agents
  const agents = [
    new PRDAgent(agentConfigs[0], store),
    new RequirementsAgent(agentConfigs[1], store),
    new PrioritizationAgent(agentConfigs[2], store),
  ];

  console.log(`[ProductDesign] Running ${agents.length} product design agents...\n`);

  // Run sequentially (requirements depend on PRD, prioritization depends on requirements)
  const results = [];
  for (const agent of agents) {
    const result = await agent.execute();
    results.push(result);
    console.log(`  ✓ ${result.agentName}: ${result.genomeWrites.length} nodes\n`);
  }

  // Verify genome
  console.log("[ProductDesign] Verifying genome population...");
  const genome = store.getGenome();

  const visionCount = genome.vision ? 1 : 0;
  const goalCount = genome.goals?.length || 0;
  const featureCount = genome.features?.length || 0;
  const requirementCount = genome.requirements?.length || 0;
  const decisionCount = genome.decisions?.length || 0;

  console.log(`  - Vision: ${visionCount} node`);
  console.log(`  - Goals: ${goalCount} nodes`);
  console.log(`  - Features: ${featureCount} nodes`);
  console.log(`  - Requirements: ${requirementCount} nodes (MUST: ${(genome.requirements || []).filter((r) => r.priority === "must").length}, SHOULD: ${(genome.requirements || []).filter((r) => r.priority === "should").length}, COULD: ${(genome.requirements || []).filter((r) => r.priority === "could").length})`);
  console.log(`  - Decisions (roadmap): ${decisionCount} nodes (v1, v2, v3)`);

  // Export PRD summary
  const summary = {
    vision: genome.vision?.title,
    goals: genome.goals?.map((g) => ({ title: g.title, priority: g.priority })),
    features_count: featureCount,
    requirements: {
      must: (genome.requirements || []).filter((r) => r.priority === "must").length,
      should: (genome.requirements || []).filter((r) => r.priority === "should").length,
      could: (genome.requirements || []).filter((r) => r.priority === "could").length,
    },
    roadmap: {
      v1: "MVP (6 months): send/receive, custom domain, privacy",
      v2: "Growth (6-12 months): teams, mobile app",
      v3: "Market leader (12+ months): AI, integrations",
    },
  };

  await store.exportToJSON("./output/05_PRD/product-design.json");
  console.log(`\n[ProductDesign] Exported design to output/05_PRD/product-design.json`);
  console.log(`\n${JSON.stringify(summary, null, 2)}`);

  console.log(`\n=== SESSION 3 COMPLETE ===`);
  console.log(`Product design complete. Ready for Session 4: Architecture.`);
}

if (require.main === module) {
  runProductDesign().catch((err) => {
    console.error("Product design failed:", err);
    process.exit(1);
  });
}
