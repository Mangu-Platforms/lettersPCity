/**
 * USER PAIN AGENT
 * Research: What frustrates email users today?
 * Output: pain points segmented by user type
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, ResearchFindingNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class UserPainAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Identifying user pain points across email hosting platforms and use cases.

User segments analyzed:
1. Privacy advocates: fear data collection, tracking, targeted ads
2. Power users: need advanced rules, filters, integrations, APIs
3. Business users: need collaboration, delegated access, team mailboxes
4. Indie creators: need custom domains, professional branding, email as product

Pain points by category:
- Privacy: data mining, ad targeting, lack of encryption, storage location concerns
- Usability: overwhelming features, poor mobile, slow search, confusing UX
- Reliability: downtime, lost emails, spam filtering too aggressive/lenient
- Cost: paying for features they don't need, per-user pricing, storage limits
- Control: no custom domains, forced features, can't export data, lock-in
- Integration: poor API, no webhook support, limited third-party connections
- Performance: slow loading, unresponsive mobile, search delays
- Security: account compromises, lack of 2FA, password reuse`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "Product Hunt reviews and discussions",
      "Reddit: r/email, r/privacy, r/webdev",
      "Hacker News: Ask HN threads on email",
      "User reviews: Trustpilot, G2, Capterra",
      "Twitter/X discussions: #EmailHosting",
      "GitHub issues on open-source email projects",
      "Blog posts: indie creators using email as a service",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const painsBySegment = [
      {
        segment: "Privacy Advocates",
        pains: [
          { issue: "Data collection", severity: "high", example: "Gmail tracks emails for ad targeting" },
          { issue: "No encryption by default", severity: "high", example: "Most email is sent in plaintext" },
          { issue: "Server location opaque", severity: "medium", example: "Don't know where data is stored" },
          { issue: "Lack of transparency", severity: "high", example: "No clear privacy policy" },
          { issue: "No data export", severity: "medium", example: "Can't retrieve historical emails easily" },
        ],
      },
      {
        segment: "Power Users",
        pains: [
          { issue: "Limited email rules", severity: "medium", example: "Gmail rules are basic; Fastmail better" },
          { issue: "No API", severity: "high", example: "Can't automate complex workflows" },
          { issue: "Poor IMAP performance", severity: "high", example: "Gmail IMAP is slow and rate-limited" },
          { issue: "No webhooks", severity: "medium", example: "Can't trigger external actions on email events" },
          { issue: "Limited integrations", severity: "medium", example: "CRM, helpdesk, automation platforms" },
        ],
      },
      {
        segment: "Business Users",
        pains: [
          { issue: "No team mailboxes", severity: "high", example: "Hard to manage shared inboxes (e.g., support@)" },
          { issue: "Delegated access is clunky", severity: "high", example: "Gmail's delegation works but feels bolted-on" },
          { issue: "Audit logs missing", severity: "high", example: "Can't track who did what and when" },
          { issue: "Mobile is weak", severity: "medium", example: "Mobile email clients don't match desktop" },
          { issue: "Cost per user", severity: "medium", example: "Microsoft 365 is expensive at scale" },
        ],
      },
      {
        segment: "Indie Creators",
        pains: [
          { issue: "No custom domain", severity: "high", example: "Can't use creator@brand.com" },
          { issue: "No branding", severity: "high", example: "Email footer says 'Powered by Gmail'" },
          { issue: "Email list integration weak", severity: "high", example: "Can't easily send newsletters to subscribers" },
          { issue: "No transactional email API", severity: "high", example: "Can't send order confirmations, receipts" },
          { issue: "Cost structure unclear", severity: "medium", example: "Pricing doesn't scale with growth" },
        ],
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const segment of painsBySegment) {
      const node: ResearchFindingNode = {
        id: uuidv4(),
        type: "research",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        category: "user_pain",
        title: `User Pain Points: ${segment.segment}`,
        summary: segment.pains
          .map((p) => `${p.issue} (${p.severity}): ${p.example}`)
          .join("\n"),
        evidence: citations,
        implication: `Letters should focus on solving ${segment.segment} pain points: ${segment.pains
          .filter((p) => p.severity === "high")
          .map((p) => p.issue)
          .join(", ")}`,
        relatedRequirementIds: [],
      };
      nodes.push(node);
    }

    // Create aggregated pain priorities
    const priorityNode: ResearchFindingNode = {
      id: uuidv4(),
      type: "research",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      category: "user_pain",
      title: "Top User Pain Points (Aggregated)",
      summary: `High-severity pains across all segments:
1. Privacy/data collection (privacy advocates)
2. Custom domains (indie creators)
3. API access (power users)
4. Team/shared mailboxes (business users)
5. Encryption by default (privacy advocates)
6. Weak mobile experience (all segments)
7. Cost at scale (indie creators, business)`,
      evidence: citations,
      implication: "Letters' MVP should address: (1) privacy + encryption by default, (2) custom domain support, (3) clean mobile UX, (4) basic API for integrations. Secondary: team features, advanced rules, audit logs.",
      relatedRequirementIds: [],
    };
    nodes.push(priorityNode);

    return nodes;
  }
}
