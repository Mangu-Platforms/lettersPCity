/**
 * RESEARCH SWARM ORCHESTRATOR
 * Session 2: Run all 5 research agents in parallel
 * Populate genome with competitive, user, trend, patent, and architecture insights
 */

import { getGenomeStore } from "../genome-store";
import { SessionDirector } from "../session-director";
import { CompetitorAgent } from "../agents/competitor-agent";
import { UserPainAgent } from "../agents/user-pain-agent";
import { TrendAgent } from "../agents/trend-agent";
import { PatentAgent } from "../agents/patent-agent";
import { ReverseEngineerAgent } from "../agents/reverse-engineer-agent";
import { AgentConfig } from "../agent-framework";

export async function runResearchSwarm(): Promise<void> {
  console.log("\n=== SESSION 2: RESEARCH SWARM ===\n");

  // Initialize genome store
  const store = await getGenomeStore();
  const director = new SessionDirector(store);
  await director.initialize();

  // Define agent configs
  const agentConfigs: AgentConfig[] = [
    {
      id: "competitor-agent-001",
      name: "Competitor Analyst",
      layer: "research",
      capabilities: ["competitive_analysis", "feature_comparison", "pricing_analysis"],
    },
    {
      id: "user-pain-agent-001",
      name: "User Pain Researcher",
      layer: "research",
      capabilities: ["user_research", "pain_point_analysis", "segment_analysis"],
    },
    {
      id: "trend-agent-001",
      name: "Trend Analyst",
      layer: "research",
      capabilities: ["trend_detection", "regulatory_analysis", "opportunity_identification"],
    },
    {
      id: "patent-agent-001",
      name: "Patent Analyst",
      layer: "research",
      capabilities: ["patent_research", "risk_assessment", "design_freedom_analysis"],
    },
    {
      id: "reverse-engineer-agent-001",
      name: "Architecture Reverse Engineer",
      layer: "research",
      capabilities: ["system_analysis", "architecture_inference", "design_pattern_identification"],
    },
  ];

  // Create agent instances
  const agents = [
    new CompetitorAgent(agentConfigs[0], store),
    new UserPainAgent(agentConfigs[1], store),
    new TrendAgent(agentConfigs[2], store),
    new PatentAgent(agentConfigs[3], store),
    new ReverseEngineerAgent(agentConfigs[4], store),
  ];

  console.log(`[Swarm] Starting ${agents.length} research agents in parallel...\n`);

  // Run agents in parallel
  const startTime = Date.now();
  const results = await Promise.all(agents.map((agent) => agent.execute()));
  const elapsed = Date.now() - startTime;

  // Summary
  console.log(`\n[Swarm] All agents completed in ${(elapsed / 1000).toFixed(2)}s\n`);

  const totalNodes = results.reduce((sum, r) => sum + r.genomeWrites.length, 0);
  console.log(`[Swarm] Genome writes: ${totalNodes} nodes`);

  for (const result of results) {
    console.log(`  - ${result.agentName}: ${result.genomeWrites.length} nodes`);
  }

  // Query genome to verify
  console.log(`\n[Swarm] Verifying genome population...`);
  const genome = store.getGenome();
  const researchNodes = genome.research || [];
  console.log(`  - Research findings: ${researchNodes.length}`);
  console.log(`    - Competitors: ${researchNodes.filter((n) => n.category === "competitor").length}`);
  console.log(`    - User pains: ${researchNodes.filter((n) => n.category === "user_pain").length}`);
  console.log(`    - Trends: ${researchNodes.filter((n) => n.category === "trend").length}`);
  console.log(`    - Patents: ${researchNodes.filter((n) => n.category === "patent").length}`);
  console.log(`    - System models: ${researchNodes.filter((n) => n.category === "system_model").length}`);

  // Export research to JSON for analysis
  await store.exportToJSON("./output/02_Research/research-findings.json");
  console.log(`\n[Swarm] Exported research findings to output/02_Research/research-findings.json`);

  console.log(`\n=== SESSION 2 COMPLETE ===`);
  console.log(`Ready for Session 3: Product Design`);
}

if (require.main === module) {
  runResearchSwarm().catch((err) => {
    console.error("Research swarm failed:", err);
    process.exit(1);
  });
}
