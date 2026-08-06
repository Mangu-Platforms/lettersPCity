/**
 * PRIORITIZATION AGENT
 * Create v1/v2/v3 roadmap based on MUST/SHOULD/COULD requirements
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class PrioritizationAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Creating prioritized roadmap (v1, v2, v3) based on requirements and market opportunity.

Approach: Start with MUST requirements (minimum viable product), add SHOULD in v2, COULD in v3+

v1 focus: Send/receive, custom domain, privacy, clean UX. Target: 1M signups, launch in 6 months.
v2 focus: Team features, advanced rules, mobile app. Target: enterprise sales, 5M users.
v3 focus: AI assistant, advanced search, calendar integration. Target: market leader position, 50M users.`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "Requirements (REQ-001 through REQ-015)",
      "Research findings (market opportunity, user pain points)",
      "Founder belief: focus, simplicity, privacy",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const roadmap = {
      v1: {
        title: "MVP Launch (6 months)",
        description: "Minimum viable product: send/receive, custom domain, privacy. Target for early adopters.",
        timeline: "6 months",
        storyCount: 20,
        requirements: [
          "REQ-001", "REQ-002", "REQ-003", // Auth
          "REQ-004", "REQ-005", "REQ-006", "REQ-007", "REQ-008", "REQ-009", // Email core
          "REQ-010", "REQ-011", "REQ-012", // Non-functional
        ],
        successMetrics: ["1K beta users", "99.9% uptime", "User feedback NPS >40"],
        risks: [
          "SMTP receiver stability under load",
          "DNS propagation delays",
          "Email delivery to major providers (Gmail deliverability)",
        ],
        dependencies: ["PostgreSQL setup", "SMTP infrastructure", "Auth0 or similar", "Kubernetes cluster"],
      },
      v2: {
        title: "Growth & Polish (6 months)",
        description: "Team features, enterprise features, mobile app. Target for small teams and businesses.",
        timeline: "6-12 months post-launch",
        storyCount: 30,
        requirements: [
          "REQ-013", "REQ-014", // Team features
          "REQ-015", // Mobile app (start)
        ],
        successMetrics: ["100K paid users", "5M revenue ARR", "NPS >50"],
        risks: [
          "Mobile app platform differences (iOS vs Android)",
          "Scaling to 100M emails/day",
          "Competitive response from HEY, Fastmail",
        ],
        dependencies: ["v1 foundation stable", "React Native or Flutter", "AWS Elasticache for scaling"],
      },
      v3: {
        title: "Market Leadership (12+ months)",
        description: "AI features, advanced integrations, market expansion. Target for entire email market.",
        timeline: "12+ months post-launch",
        storyCount: "TBD",
        requirements: [
          "AI email summarization",
          "Smart compose (AI drafting)",
          "Calendar integration (CalDAV)",
          "Advanced email rules engine",
          "API for third-party integrations",
        ],
        successMetrics: ["10M users", "$50M revenue ARR", "NPS >60"],
        risks: [
          "AI feature quality vs competitors",
          "Regulatory pressure on AI (EU AI Act)",
          "Market consolidation (acquisition by Big Tech)",
        ],
        dependencies: ["LLM API (Claude, GPT, etc.)", "CalDAV server", "Public API ecosystem"],
      },
    };

    const nodes: GenomeNode[] = [];

    // Create decision nodes for each version
    for (const [version, phase] of Object.entries(roadmap)) {
      const decisionNode: any = {
        id: uuidv4(),
        type: "decision",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        title: `${version.toUpperCase()} Roadmap: ${phase.title}`,
        context: phase.description,
        options: [
          {
            name: `Launch ${version.toUpperCase()}`,
            pros: ["Delivers user value", "Earns revenue", "Gathers market feedback"],
            cons: ["Takes time", "Requires resources", "Delays next version"],
          },
          {
            name: `Defer to next phase`,
            pros: ["Focuses team", "Launches faster", "Simpler MVP"],
            cons: ["Delays feature", "Users wait", "Competitors move faster"],
          },
        ],
        chosen: `Launch ${version.toUpperCase()}`,
        reasoning: `Market opportunity is large enough to justify full ${version.toUpperCase()} scope. Competitive pressure requires shipping ${version.toUpperCase()} features on schedule.`,
        tradeoffs: `Choosing ${version.toUpperCase()} means deferring ${version === "v1" ? "v2" : version === "v2" ? "v3" : "later"} features. Prioritization ensures focus.`,
        relatedRequirementIds: phase.requirements,
      };
      nodes.push(decisionNode);
    }

    return nodes;
  }
}
