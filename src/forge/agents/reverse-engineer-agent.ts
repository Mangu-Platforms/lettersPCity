/**
 * REVERSE ENGINEERING AGENT
 * Research: What's the hidden architecture behind Gmail, HEY, Fastmail?
 * Output: inferred system architectures and design patterns
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, ResearchFindingNode } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class ReverseEngineerAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Reverse-engineering architecture of major email platforms from public signals.

Analysis methods:
1. Job postings: reveals tech stack (languages, databases, infra)
2. Talks/conference presentations: architecture decisions
3. Blog posts: engineering insights
4. Public APIs: hints at data model
5. Performance observations: inferred infra (CDN, caching, queuing)
6. Regulatory filings: revenue, scale, infrastructure costs
7. Network inspection: protocols, latency, routing
8. Security bulletins: exposure of infrastructure choices
9. Hiring patterns: scaling directions

Gmail architecture (inferred):
- BigTable (GFS-based storage) for email, contacts, settings
- Colossus (distributed FS) for attachments
- Bigtable + MapReduce for search indexing
- Protobuf for serialization
- Custom routing layer (Paxos-based replication)
- Spanner for transactions
- Cloud Storage for backups
- PubSub for events

HEY architecture (inferred):
- Ruby on Rails monolith (from tech stack signals)
- PostgreSQL for primary data
- Redis for caching and sessions
- ActiveStorage for attachments (on-disk or S3)
- Single provider (37signals Basecamp infra)
- Smaller scale (10k-100k users initially)
- Focus on simplicity over scale

Fastmail architecture (inferred):
- Mixed Python/Perl/C (legacy system)
- Custom storage engine
- Distributed across multiple data centers
- Open standards (IMAP, CalDAV, CardDAV)
- In-house infrastructure (not AWS/GCP)
- Performance-optimized for power users`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "Google Cloud Blog: Gmail architecture posts",
      "LinkedIn Engineering blog",
      "Basecamp Blog: HEY technical decisions",
      "Fastmail blog posts on architecture",
      "YouTube: tech talks on email systems",
      "Job postings: Gmail, HEY, Fastmail",
      "GitHub: inferred from open-source dependencies",
      "API documentation and terms of service",
      "Performance benchmarking sites",
      "Security research papers on email systems",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const systemModels = [
      {
        platform: "Gmail",
        scale: "1.8B users",
        dataStore: "BigTable + Colossus (Google's GFS derivative)",
        searchEngine: "Custom MapReduce-based indexing",
        messaging: "Protobuf, custom RPC",
        caching: "Memcache layer",
        cdn: "Global CDN (Google's network)",
        backup: "Geo-replicated to 3+ regions",
        keyInsight: "Designed for planetary scale from day 1. Monolithic, vertically integrated.",
      },
      {
        platform: "HEY",
        scale: "100k-500k users (estimated)",
        dataStore: "PostgreSQL + Redis",
        searchEngine: "PostgreSQL full-text search or Elasticsearch",
        messaging: "HTTP API, REST",
        caching: "Redis (sessions, cache)",
        cdn: "Cloudflare or similar",
        backup: "Standard DB backups",
        keyInsight: "Designed for simplicity and single-provider operation. Monolithic Rails app.",
      },
      {
        platform: "Fastmail",
        scale: "500k-1M users (estimated)",
        dataStore: "Custom distributed storage, PostgreSQL for metadata",
        searchEngine: "Custom index (not Elasticsearch)",
        messaging: "Protocol-focused (IMAP, SMTP, CalDAV, CardDAV)",
        caching: "In-house caching layer",
        cdn: "Content delivery via CDN partners",
        backup: "Multi-region backups",
        keyInsight: "Optimized for performance and standards. Hybrid of custom + open protocols.",
      },
      {
        platform: "Proton Mail",
        scale: "100M+ accounts (claim)",
        dataStore: "PostgreSQL + proprietary encryption layer",
        searchEngine: "PostgreSQL (encrypted search) or custom",
        messaging: "REST API + WebSocket for realtime",
        caching: "Redis for sessions",
        cdn: "CloudFlare",
        backup: "Encrypted backups (can't decrypt even they can't read)",
        keyInsight: "Encryption-first architecture. Zero-access encryption means minimal server-side search capability.",
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const model of systemModels) {
      const node: ResearchFindingNode = {
        id: uuidv4(),
        type: "research",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        category: "system_model",
        title: `${model.platform} System Architecture (Reverse Engineered)`,
        summary: `Scale: ${model.scale}. Data: ${model.dataStore}. Search: ${model.searchEngine}. Messaging: ${model.messaging}. Cache: ${model.caching}. Backup: ${model.backup}.`,
        evidence: citations,
        implication: model.keyInsight,
        relatedRequirementIds: [],
      };
      nodes.push(node);
    }

    // Architecture recommendations for Letters
    const recommendationNode: ResearchFindingNode = {
      id: uuidv4(),
      type: "research",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.config.id,
      version: 1,
      category: "system_model",
      title: "Recommended Architecture for Letters (v1)",
      summary: `Hybrid of HEY simplicity + Fastmail performance + Proton privacy:
- Data: PostgreSQL (proven, open, reliable) + Redis for caching
- Search: PostgreSQL full-text search initially; Elasticsearch if scale demands
- Messaging: REST API + gRPC for internal services
- Protocols: IMAP, SMTP, CalDAV (standards, portability)
- Encryption: TLS in transit + optional server-side encryption
- Deployment: Kubernetes or Docker on GCP/AWS
- Backup: Daily snapshots to cloud storage (accessible for recovery)
- CDN: CloudFlare for static assets
- Rate limiting: Upstash Redis for sliding window counters

Philosophy: Start simple (monolith), scale horizontally (service boundaries) as needed.`,
      evidence: citations,
      implication: "Letters should choose: PostgreSQL (not BigTable), REST API (not custom RPC), CloudFlare (not own CDN), Docker (not custom infra). This gives scale-up path without over-engineering for v1.",
      relatedRequirementIds: [],
    };
    nodes.push(recommendationNode);

    return nodes;
  }
}
