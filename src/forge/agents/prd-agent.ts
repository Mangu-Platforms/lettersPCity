/**
 * PRD AGENT
 * Synthesize vision + research into formal Product Requirements Document
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, GoalNodeSchema, FeatureNodeSchema } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class PRDAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Synthesizing research findings (31 nodes) + founder intent into formal PRD.

Vision: Letters is the privacy-first email platform for indie creators and power users.
- Privacy + encryption by default (core differentiator)
- Custom domain support (founders need brandability)
- Clean, focused UX (inspired by HEY's minimalism)
- Standards-based (IMAP/SMTP for portability; not lock-in)
- Indie pricing ($49-99/year, not per-user)

Target user: privacy-conscious indie creators, solopreneurs, small teams seeking professional email without surveillance.

Competitive positioning: "HEY's simplicity + Fastmail's domain support + Proton's privacy"

Success metrics:
- 1M signups in year 1
- 10% revenue from paid subscriptions (rest from enterprise)
- NPS ≥ 50 (customer satisfaction)
- <99.9% uptime (reliability)
- <2s mailbox load (performance)
- 0 data breaches (security)`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "Research findings (competitor analysis, user pain points, trends, patent review)",
      "Founder vision: Letters as privacy-first, indie-focused email",
      "Market analysis: creator economy growth, privacy regulation acceleration",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const nodes: GenomeNode[] = [];

    // Vision node
    const visionNode: any = {
      id: uuidv4(),
      type: "vision",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      title: "Letters: The Privacy-First Email for Creators",
      content: `Letters is an email hosting platform designed for indie creators, solopreneurs, and power users who value privacy and want professional email on their own domain.

Core beliefs:
1. Privacy is a right, not a premium feature
2. Users should own their data and be able to leave anytime (portability)
3. Email should be simple and focused (not overwhelming)
4. Pricing should be fair and transparent (not per-user surveillance)
5. Standards matter (IMAP/SMTP, open formats)

Positioning: The intersection of HEY (simplicity) + Fastmail (custom domains) + Proton (privacy)`,
      keyPrinciples: [
        "Privacy by default",
        "User data ownership",
        "Clean, focused UX",
        "Standards-based (no lock-in)",
        "Transparent, fair pricing",
        "Indie creator focus",
      ],
    };
    nodes.push(visionNode);

    // Goals
    const goals = [
      {
        title: "Establish privacy-first market position",
        description: "Letters becomes known as the privacy-first email platform for creators",
        metrics: [
          { name: "Brand awareness", target: "20% of target demographic", measurementMethod: "Survey" },
          { name: "Privacy feature adoption", target: "95% enable encryption", measurementMethod: "Product analytics" },
        ],
        priority: "p0",
      },
      {
        title: "Enable professional email on custom domains",
        description: "Every user can host email on their own domain with simple setup",
        metrics: [
          { name: "Custom domain adoption", target: "80% of users", measurementMethod: "Product analytics" },
          { name: "Setup time", target: "<5 minutes", measurementMethod: "User testing" },
        ],
        priority: "p0",
      },
      {
        title: "Achieve platform reliability and performance",
        description: "Letters is fast, reliable, and trustworthy",
        metrics: [
          { name: "Uptime", target: "99.9%", measurementMethod: "Monitoring" },
          { name: "Mailbox load time", target: "<2s", measurementMethod: "Performance testing" },
          { name: "Zero data breaches", target: "0", measurementMethod: "Security audits" },
        ],
        priority: "p0",
      },
      {
        title: "Build sustainable business model",
        description: "Letters is profitable and sustainable without selling user data",
        metrics: [
          { name: "ARR (annual recurring revenue)", target: "$10M by end of year 2", measurementMethod: "Finance" },
          { name: "Customer acquisition cost", target: "<$30", measurementMethod: "Marketing analytics" },
          { name: "Lifetime value", target: ">$500", measurementMethod: "Cohort analysis" },
        ],
        priority: "p1",
      },
    ];

    for (const goal of goals) {
      const goalNode: any = {
        id: uuidv4(),
        type: "goal",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        title: goal.title,
        description: goal.description,
        metrics: goal.metrics,
        relatedVisionId: visionNode.id,
        priority: goal.priority,
      };
      nodes.push(goalNode);
    }

    // Features (v1)
    const features = [
      {
        name: "User signup + authentication",
        userValue: "Create professional email account",
        relatedGoal: "Enable professional email on custom domains",
      },
      {
        name: "Custom domain setup",
        userValue: "Host email on my own domain (myname.com)",
        relatedGoal: "Enable professional email on custom domains",
      },
      {
        name: "Inbox with reading",
        userValue: "Receive and read emails in clean interface",
        relatedGoal: "Achieve platform reliability and performance",
      },
      {
        name: "Email composition and sending",
        userValue: "Write and send emails from my domain",
        relatedGoal: "Enable professional email on custom domains",
      },
      {
        name: "Encryption support",
        userValue: "Encrypt emails so only recipients can read",
        relatedGoal: "Establish privacy-first market position",
      },
      {
        name: "Search",
        userValue: "Find emails by sender, subject, or content",
        relatedGoal: "Achieve platform reliability and performance",
      },
      {
        name: "Archive + trash",
        userValue: "Organize emails (move to archive, trash)",
        relatedGoal: "Achieve platform reliability and performance",
      },
      {
        name: "Mobile-responsive UI",
        userValue: "Read and compose on mobile phones",
        relatedGoal: "Achieve platform reliability and performance",
      },
    ];

    for (const feature of features) {
      const featureNode: any = {
        id: uuidv4(),
        type: "feature",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        name: feature.name,
        description: `User-facing feature: ${feature.name}`,
        userValue: feature.userValue,
        relatedGoalIds: [], // Will link in workflow
        status: "ideated",
        version: "v1",
      };
      nodes.push(featureNode);
    }

    return nodes;
  }
}
