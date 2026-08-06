/**
 * FORGE INITIALIZATION
 * Verify framework setup and optionally start MCP server.
 */

import { getGenomeStore } from "./forge/genome-store";
import { ConstitutionValidator, Decision } from "./forge/constitution";
import { SessionDirector } from "./forge/session-director";
import { v4 as uuidv4 } from "uuid";

async function main() {
  console.log("=== FORGE: Autonomous Product Foundry ===\n");

  // Initialize genome store
  console.log("[Init] Initializing Genome Store...");
  const store = await getGenomeStore();
  const genome = store.getGenome();
  console.log(`[Init] Genome loaded. Nodes: ${Object.values(genome).filter((v) => Array.isArray(v)).reduce((sum, arr) => sum + (arr as any[]).length, 0)}`);

  // Test constitution validator
  console.log("\n[Init] Testing Constitution Validator...");
  const validator = new ConstitutionValidator();
  const testDecision: Decision = {
    id: uuidv4(),
    reasoning: "Testing the constitution validator",
    source: "founder_belief",
    sourceId: "test-node-001",
    timestamp: new Date(),
    agentId: "test-agent",
  };
  const result = validator.validate(testDecision);
  console.log(`[Init] Validation result: ${result.passed ? "PASSED" : "FAILED"}`);
  if (!result.passed) {
    result.violations.forEach((v) => console.log(`  - ${v}`));
  }

  // Initialize session director
  console.log("\n[Init] Initializing Session Director...");
  const director = new SessionDirector(store);
  await director.initialize();
  const summary = director.getSummary();
  console.log(`[Init] Phase: ${summary.phase}`);
  console.log(`[Init] Tasks: ${summary.totalTasks} (${summary.completed} completed, ${summary.pending} pending, ${summary.blocked} blocked)`);

  // Export progress
  console.log("\n[Init] Session Progress:");
  const progress = director.exportProgress();
  console.log(JSON.stringify(progress, null, 2));

  console.log("\n=== FORGE Framework Ready ===");
  console.log("Next steps:");
  console.log("  - Start MCP server: FORGE_API_PORT=3333 npm run forge:server");
  console.log("  - Create first genome nodes via API: POST /genome/vision, /genome/goals, etc.");
  console.log("  - Implement research agents for Session 2");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
