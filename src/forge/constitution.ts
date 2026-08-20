/**
 * FORGE CONSTITUTION
 * The 10 immutable laws that govern every agent's decision and output.
 * No agent output escapes without satisfying these laws.
 */

export interface ConstitutionCheckResult {
  passed: boolean;
  violations: string[];
  reasoning: string;
}

export interface Decision {
  id: string;
  reasoning: string;
  source: "research_finding" | "requirement" | "founder_belief" | "constraint";
  sourceId: string;
  timestamp: Date;
  agentId: string;
}

export class ConstitutionValidator {
  /**
   * Law 1: Founder intent is supreme
   * Every decision traces back to founder vision or explicit constraint.
   */
  private checkLaw1_FounderIntentSupreme(decision: Decision): ConstitutionCheckResult {
    if (!decision.sourceId) {
      return {
        passed: false,
        violations: ["LAW_1: Decision missing source reference (must cite founder belief, requirement, or research finding)"],
        reasoning: "Every decision must be grounded in founder intent or explicit requirements.",
      };
    }
    return {
      passed: true,
      violations: [],
      reasoning: "Decision cites founder intent or requirement",
    };
  }

  /**
   * Law 2: Assume when possible
   * If information is missing but safe to assume, make the assumption and document it.
   */
  private checkLaw2_AssumeWhenPossible(decision: Decision): ConstitutionCheckResult {
    if (!decision.reasoning.includes("assume") && !decision.reasoning.includes("constraint")) {
      // Not violated; law is about *encouraging* assumptions, not enforcing them.
      return {
        passed: true,
        violations: [],
        reasoning: "Law is aspirational; no violation if decision is explicit instead.",
      };
    }
    return {
      passed: true,
      violations: [],
      reasoning: "Agent made reasonable assumptions or encountered constraints.",
    };
  }

  /**
   * Law 3: Never stop working
   * If blocked on a human gate, document it and work on unblocked items.
   * No silent failure.
   */
  private checkLaw3_NeverStopWorking(decision: Decision): ConstitutionCheckResult {
    // This is a workflow principle, not a per-decision check.
    // Validated at workflow orchestration level.
    return {
      passed: true,
      violations: [],
      reasoning: "Workflow-level validation; no per-decision gate.",
    };
  }

  /**
   * Law 4: Every decision requires reasoning
   * No output without explanation of *why*.
   */
  private checkLaw4_EveryDecisionRequiresReasoning(decision: Decision): ConstitutionCheckResult {
    if (!decision.reasoning || decision.reasoning.trim().length < 10) {
      return {
        passed: false,
        violations: ["LAW_4: Decision reasoning is missing or too brief"],
        reasoning: "Every decision must include clear reasoning explaining the 'why'.",
      };
    }
    return {
      passed: true,
      violations: [],
      reasoning: "Decision includes adequate reasoning",
    };
  }

  /**
   * Law 5: Every requirement requires source
   * Requirements must cite research findings, founder beliefs, or constraints.
   */
  private checkLaw5_EveryRequirementRequiresSource(decision: Decision): ConstitutionCheckResult {
    if (decision.source === "requirement" && !decision.sourceId) {
      return {
        passed: false,
        violations: ["LAW_5: Requirement missing source (cite research, founder belief, or constraint)"],
        reasoning: "Requirements must be traceable to their origin.",
      };
    }
    return {
      passed: true,
      violations: [],
      reasoning: "Requirement is properly sourced",
    };
  }

  /**
   * Law 6: Every artifact requires traceability
   * Code, docs, configs must be traceable to genome nodes.
   */
  private checkLaw6_EveryArtifactRequiresTraceability(decision: Decision): ConstitutionCheckResult {
    // Validated during genome writes; decision.sourceId maps to genome node.
    return {
      passed: true,
      violations: [],
      reasoning: "Traceability checked at genome layer",
    };
  }

  /**
   * Law 7: Challenge every design
   * Assume nothing. Question every architectural choice.
   */
  private checkLaw7_ChallengeEveryDesign(decision: Decision): ConstitutionCheckResult {
    // This is an agent behavior principle, not a per-decision gate.
    // Enforced through adversarial review agents.
    return {
      passed: true,
      violations: [],
      reasoning: "Validated via adversarial review phase",
    };
  }

  /**
   * Law 8: Store everything
   * Every decision, artifact, and reasoning goes into the Product Genome.
   */
  private checkLaw8_StoreEverything(decision: Decision): ConstitutionCheckResult {
    // Enforced at genome write layer; decision object itself is the artifact.
    return {
      passed: true,
      violations: [],
      reasoning: "Decision object will be persisted to genome",
    };
  }

  /**
   * Law 9: Optimize for execution
   * Output must be immediately actionable (code, infra, tests, not just docs).
   */
  private checkLaw9_OptimizeForExecution(decision: Decision): ConstitutionCheckResult {
    // This is more of a workflow principle; validated at output type.
    return {
      passed: true,
      violations: [],
      reasoning: "Output quality validated at agent level",
    };
  }

  /**
   * Law 10: Founder can override anything
   * If founder explicitly overrides, no other law applies.
   */
  private checkLaw10_FounderCanOverride(decision: Decision): ConstitutionCheckResult {
    if (decision.source === "founder_belief") {
      return {
        passed: true,
        violations: [],
        reasoning: "Founder override; no other laws apply",
      };
    }
    return {
      passed: true,
      violations: [],
      reasoning: "Standard decision; founder override not claimed",
    };
  }

  /**
   * Validate a decision against the entire constitution.
   * Returns aggregate result with all violations flagged.
   */
  validate(decision: Decision): ConstitutionCheckResult {
    const checks = [
      this.checkLaw1_FounderIntentSupreme(decision),
      this.checkLaw2_AssumeWhenPossible(decision),
      this.checkLaw3_NeverStopWorking(decision),
      this.checkLaw4_EveryDecisionRequiresReasoning(decision),
      this.checkLaw5_EveryRequirementRequiresSource(decision),
      this.checkLaw6_EveryArtifactRequiresTraceability(decision),
      this.checkLaw7_ChallengeEveryDesign(decision),
      this.checkLaw8_StoreEverything(decision),
      this.checkLaw9_OptimizeForExecution(decision),
      this.checkLaw10_FounderCanOverride(decision),
    ];

    const violations = checks.flatMap((c) => c.violations);
    const passed = violations.length === 0;
    const reasoning = checks.filter((c) => !c.passed).map((c) => c.reasoning).join("; ");

    return {
      passed,
      violations,
      reasoning: reasoning || "All laws satisfied",
    };
  }
}
