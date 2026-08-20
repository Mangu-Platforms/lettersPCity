/**
 * TREND AGENT
 * Research: industry shifts, regulatory changes, emerging technologies
 * Output: trends and regulatory constraints
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, ResearchFindingNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class TrendAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Analyzing industry trends and regulatory landscape affecting email platforms.

Trends analyzed:
1. Privacy regulations: GDPR, CCPA, LGPD, data residency requirements
2. AI in email: automated prioritization, summarization, drafting assistance
3. Decentralization: ActivityPub, open standards, interoperability
4. Authentication: DKIM, SPF, DMARC adoption; passwordless auth
5. Mobile-first: email increasingly read on mobile; UX must adapt
6. Zero-knowledge: encrypted email gaining adoption
7. Creator economy: email as a service for indie creators, solopreneurs
8. Interoperability: users want to move providers without data loss`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "GDPR requirements (EU regulation on data protection)",
      "CCPA requirements (California privacy law)",
      "LGPD (Brazilian privacy law)",
      "DMARC, SPF, DKIM standards (authentication)",
      "ActivityPub standard (decentralized social)",
      "OpenAI/Claude capabilities in email (AI trends)",
      "Mobile email trends (Statista, reports)",
      "Industry conferences: Inbox 2024, Email Geek Summit",
      "Privacy Foundation reports",
      "W3C email standards working group",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const trends = [
      {
        title: "Privacy Regulation Acceleration",
        description: "GDPR (EU), CCPA (CA), LGPD (Brazil), UK-GDPR. More countries adopting privacy laws.",
        implication: "Letters must be designed for GDPR compliance from day 1: data residency options, user export, deletion guarantees, privacy-by-default.",
        requirement: "User data must be deletable on demand; audit trail for compliance; option to store data in specific regions.",
      },
      {
        title: "Passwordless Authentication Trend",
        description: "Move away from passwords toward passkeys, WebAuthn, magic links, OAuth.",
        implication: "Letters should support passkeys and WebAuthn as primary auth; passwords as fallback.",
        requirement: "Support WebAuthn; optional magic link signin; optional passwordless onboarding.",
      },
      {
        title: "AI Integration in Email",
        description: "AI for summarization, drafting, priority detection, spam filtering, search.",
        implication: "Users increasingly expect AI features. Not a v1 requirement but a differentiator in v2.",
        requirement: "Plan API hooks for future AI integration (summarization, drafting assistance).",
      },
      {
        title: "Mobile-First Expectations",
        description: "Email increasingly read on mobile (60%+ of opens). Apps expected to be first-class.",
        implication: "Web UI must be mobile-optimized; mobile app should be high priority or built-in.",
        requirement: "Web responsive design; mobile app (iOS/Android) by v1.5.",
      },
      {
        title: "Decentralization & Interoperability",
        description: "ActivityPub adoption, open standards, ability to move between providers.",
        implication: "Letters should be portable: standard data format, export/import tools, non-proprietary storage.",
        requirement: "Support email export (mbox, EML); support IMAP/SMTP for backward compatibility.",
      },
      {
        title: "Authentication Standards (DMARC/SPF/DKIM)",
        description: "Major email providers enforcing stricter authentication. Gmail, Yahoo requiring DMARC adoption.",
        implication: "Letters must support DMARC, SPF, DKIM setup for custom domains.",
        requirement: "Guided setup for DMARC/SPF/DKIM; automated validation; dashboard showing status.",
      },
      {
        title: "Creator Economy Growth",
        description: "Increase in solopreneurs, indie creators, small businesses needing professional email.",
        implication: "Market segment underserved by traditional email. Opportunity for Letters to position as 'email for creators'.",
        requirement: "Custom domain support; creator-friendly pricing; newsletter/audience features.",
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const trend of trends) {
      const node: ResearchFindingNode = {
        id: uuidv4(),
        type: "research",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        category: "trend",
        title: trend.title,
        summary: trend.description,
        evidence: citations,
        implication: trend.implication,
        relatedRequirementIds: [],
      };
      nodes.push(node);
    }

    // Add regulatory constraints summary
    const regulatoryNode: ResearchFindingNode = {
      id: uuidv4(),
      type: "research",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      category: "trend",
      title: "Regulatory Constraints Summary",
      summary: "GDPR, CCPA, LGPD require: data residency options, user consent for processing, ability to export/delete data, privacy policy, audit trail. Email-specific: support for authentication standards (DMARC, SPF, DKIM).",
      evidence: citations,
      implication: "Letters must be built with privacy and compliance as core features, not afterthoughts. This is a competitive advantage and market requirement.",
      relatedRequirementIds: [],
    };
    nodes.push(regulatoryNode);

    return nodes;
  }
}
