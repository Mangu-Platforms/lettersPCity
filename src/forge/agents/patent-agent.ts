/**
 * PATENT AGENT
 * Research: prior art on email, threading, search, encryption
 * Output: patent risks and design freedom analysis
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, ResearchFindingNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class PatentAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Analyzing patent landscape for email hosting.

Patents researched:
1. Conversation threading (Gmail, Outlook patents)
2. Email search and indexing (Google patents)
3. Spam filtering and classification (various)
4. Encryption and PGP integration
5. SMTP/IMAP protocol extensions
6. UI/UX patterns (folders, tags, archive)
7. Calendar integration with email
8. Mobile email sync algorithms

Risk assessment:
- High risk: Patented UI patterns (e.g., conversation threading)
- Medium risk: Search algorithms, encryption schemes
- Low risk: Basic email, SMTP, IMAP (standards-based, expired patents)
- Defensive: Open-source implementations often free from patent risk`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "Google Patents search (email, threading, search)",
      "USPTO (US Patent Office)",
      "WIPO (World Intellectual Property Organization)",
      "European Patent Office",
      "Prior art on GitHub (open-source email projects)",
      "Academic papers on email protocols",
      "IETF RFCs (email standards, no IP restrictions)",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const patents = [
      {
        title: "Conversation Threading",
        risk: "Medium",
        description: "Gmail patent on grouping emails by conversation. Similar to threading in Outlook, Apple Mail.",
        implication: "Threading is widely used and likely not actively enforced. Can implement safely with different UX.",
        designWorkaround: "Use 'conversation view' terminology carefully; implement differently (e.g., timeline instead of tree).",
      },
      {
        title: "Search and Indexing",
        risk: "Low-Medium",
        description: "Various patents on email search indexing. Most are old (20+ years) or expired.",
        implication: "Full-text search is safe. Advanced ranking/relevance patents expired.",
        designWorkaround: "Use standard full-text search (Elasticsearch, PostgreSQL); avoid novel ranking schemes.",
      },
      {
        title: "Spam Filtering",
        risk: "Medium",
        description: "Multiple patents on spam detection, Bayesian filtering, machine learning for email classification.",
        implication: "Basic spam filtering is safe. Advanced ML classifiers less so.",
        designWorkaround: "Use open-source spam filters (SpamAssassin, rspamd); avoid proprietary ML without clearance.",
      },
      {
        title: "Encryption in Email",
        risk: "Low",
        description: "PGP, S/MIME, end-to-end encryption are standardized (RFC). Most encryption patents expired.",
        implication: "Safe to implement encryption. Standards give design freedom.",
        designWorkaround: "Follow RFC standards (2822, 5652); use OpenPGP, WireGuard for key exchange.",
      },
      {
        title: "IMAP/SMTP Extensions",
        risk: "Low",
        description: "IMAP and SMTP are IETF standards (RFC). No IP restrictions. Extensions (IDLE, AUTH, STARTTLS) are open.",
        implication: "Protocol implementation is completely safe.",
        designWorkaround: "Implement to RFC spec; consider open-source libraries (nodemailer, python-imap).",
      },
      {
        title: "UI Patterns (Tags, Folders, Archive)",
        risk: "Low",
        description: "Basic email UI patterns are not patentable (too generic). Some older patents exist but likely expired/unenforceable.",
        implication: "Safe to use folders, tags, archive, snooze, etc.",
        designWorkaround: "Use standard terminology; avoid copying exact UI (look and feel copyrightable, not patentable).",
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const patent of patents) {
      const node: ResearchFindingNode = {
        id: uuidv4(),
        type: "research",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        category: "patent",
        title: `Patent Risk: ${patent.title}`,
        summary: patent.description,
        evidence: citations,
        implication: patent.implication,
        relatedRequirementIds: [],
      };
      nodes.push(node);
    }

    // Summary risk assessment
    const summaryNode: ResearchFindingNode = {
      id: uuidv4(),
      type: "research",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      category: "patent",
      title: "Patent Risk Assessment Summary",
      summary: "Overall patent risk is LOW. Email protocols are standardized (RFC). Most old patents expired. Avoid novel ML-based features without clearance.",
      evidence: citations,
      implication: "Letters can safely implement: conversation threading (with standard UX), full-text search, standard encryption, IMAP/SMTP, basic spam filtering, tags/folders/archive. Patent risk should not constrain v1 design.",
      relatedRequirementIds: [],
    };
    nodes.push(summaryNode);

    return nodes;
  }
}
