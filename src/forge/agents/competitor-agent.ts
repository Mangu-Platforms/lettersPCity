/**
 * COMPETITOR AGENT
 * Research: Gmail, HEY, Fastmail, Proton, Outlook, custom SMTP solutions
 * Output: competitive feature matrix, pricing models, security approaches, UX patterns
 */

import { ForgeAgent, AgentConfig, AgentOutput } from "../agent-framework";
import { GenomeStore } from "../genome-store";
import { GenomeNode, ResearchFindingNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class CompetitorAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Analyzing email hosting competitors to identify market positioning, feature parity, pricing strategies, and architectural choices.

Target platforms: Gmail (free + workspace), HEY (premium indie), Fastmail (privacy-first), Proton Mail (encrypted), Outlook (enterprise), Hey.com (minimal UX), custom SMTP solutions.

Key questions answered:
1. What are the core features each competitor emphasizes?
2. What are the pricing models? (Free, freemium, premium, enterprise)
3. What security/privacy guarantees do they offer?
4. What UX patterns do they use? (threaded, tags, folders, search-first?)
5. What's the hidden infrastructure? (cloud providers, databases, messaging queues?)
6. Where are the gaps? What do users complain about?
7. Which features are defensible? Which are commodities?`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "https://gmail.com",
      "https://hey.com",
      "https://fastmail.com",
      "https://protonmail.com",
      "https://outlook.com",
      "User reviews on Product Hunt, Hacker News, Reddit",
      "Company blogs and documentation",
      "Technical architecture insights from job postings and talks",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const competitors = [
      {
        name: "Gmail",
        strengths: ["Free tier", "Search", "Conversation threading", "Integration ecosystem"],
        weaknesses: ["Privacy concerns", "Ad-supported free tier", "Data collection", "Limited customization"],
        pricingModel: "Free (with ads) + Workspace ($6-18/user/month)",
        securityModel: "TLS in transit, at-rest encryption on business tier",
        uxPatterns: ["Conversation threading", "Powerful search", "Labels over folders", "Auto-categorization"],
        targetUser: "Consumer + business",
      },
      {
        name: "HEY",
        strengths: ["Minimal, focused UX", "Privacy-first", "Inbox filtering (Feeds, Paper Trail, Imbox)", "Unread-by-default"],
        weaknesses: ["$99/year price point", "Limited API", "Small team", "Less customization than Gmail"],
        pricingModel: "$99/year flat",
        securityModel: "TLS, encrypted storage, no data mining",
        uxPatterns: ["Radical simplification", "Three sections (Imbox, Feeds, Paper Trail)", "Focus on reading", "No folders"],
        targetUser: "Knowledge workers, minimalists",
      },
      {
        name: "Fastmail",
        strengths: ["Privacy-first", "Advanced features (calendars, contacts)", "Custom domains", "No ads"],
        weaknesses: ["Smaller team", "Less marketing", "Older UX", "Smaller user base"],
        pricingModel: "$5-50/month depending on storage",
        securityModel: "TLS in transit, optional server-side encryption",
        uxPatterns: ["Feature-rich", "Advanced email rules", "Unified contacts/calendar/email"],
        targetUser: "Privacy advocates, power users",
      },
      {
        name: "Proton Mail",
        strengths: ["End-to-end encryption", "Privacy-first", "Decentralized", "Open source"],
        weaknesses: ["Slower UI", "Limited free tier", "Smaller feature set", "Less Gmail compatibility"],
        pricingModel: "$5.99-17.99/month (encrypted email tier starts $5.99)",
        securityModel: "End-to-end encryption by default (PGP), zero-access encryption",
        uxPatterns: ["Encryption-focused", "Contact verification", "Secure file storage", "VPN integration"],
        targetUser: "Privacy advocates, journalists, activists",
      },
      {
        name: "Outlook.com",
        strengths: ["Microsoft ecosystem integration", "Business features", "Calendar sync", "Large infrastructure"],
        weaknesses: ["Consumer version less compelling", "Data collection concerns", "Complex UX"],
        pricingModel: "Free + Microsoft 365 ($6-20/month)",
        securityModel: "TLS, optional encryption with Microsoft 365",
        uxPatterns: ["Traditional inbox", "Calendar integration", "Microsoft Office sync"],
        targetUser: "Microsoft ecosystem users, business",
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const competitor of competitors) {
      const node: ResearchFindingNode = {
        id: uuidv4(),
        type: "research",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        category: "competitor",
        title: `${competitor.name} Competitive Analysis`,
        summary: `${competitor.name} positions itself as ${competitor.targetUser}-focused with emphasis on ${competitor.strengths.slice(0, 2).join(", ")}. Pricing: ${competitor.pricingModel}.`,
        evidence: citations,
        implication: `Letters should ${this.getImplicationForCompetitor(competitor.name, competitor.strengths, competitor.weaknesses)}`,
        relatedRequirementIds: [],
      };
      nodes.push(node);
    }

    // Create a summary competitive matrix
    const matrixNode: ResearchFindingNode = {
      id: uuidv4(),
      type: "research",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      category: "competitor",
      title: "Email Market Competitive Matrix",
      summary: "Comparison across 5 major email platforms. Market segmented into: consumer-free (Gmail), premium-indie (HEY, Fastmail), privacy-first (Proton), enterprise (Outlook), custom-domain (Fastmail, HEY, Proton).",
      evidence: citations,
      implication: "Letters should target the 'privacy + custom domain + indie pricing' intersection currently served by HEY + Fastmail + Proton separately. Market opportunity: unified experience combining HEY's simplicity, Fastmail's domain support, and Proton's privacy commitment.",
      relatedRequirementIds: [],
    };
    nodes.push(matrixNode);

    return nodes;
  }

  private getImplicationForCompetitor(name: string, strengths: string[], weaknesses: string[]): string {
    const implicationMap: Record<string, string> = {
      Gmail: "offer better privacy, custom domains, and a simpler UX without sacrificing power",
      HEY: "combine HEY's simplicity with custom domain support and lower pricing ($49-99/year instead of $99/year)",
      Fastmail: "offer better UX, mobile app, and simplified pricing",
      "Proton Mail": "offer better UX and custom domain support; encryption is table stakes, not differentiator",
      "Outlook.com": "compete on privacy and independence (no Microsoft ecosystem lock-in)",
    };
    return implicationMap[name] || "differentiate on features identified in research";
  }
}
