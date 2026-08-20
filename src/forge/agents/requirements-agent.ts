/**
 * REQUIREMENTS AGENT
 * Break PRD into functional + non-functional requirements (MOSCOW prioritized)
 */

import { ForgeAgent, AgentConfig } from "../agent-framework";
import { GenomeNode, RequirementNodeSchema } from "../genome.schema";
import { v4 as uuidv4 } from "uuid";

export class RequirementsAgent extends ForgeAgent {
  protected async reason(): Promise<string> {
    return `Converting PRD features into actionable requirements.

Approach: MOSCOW prioritization
- MUST: Core to v1 launch (send/receive, custom domain, privacy)
- SHOULD: Important but deferrable (team features, advanced rules)
- COULD: Nice-to-have (mobile app, calendar integration)
- WONT: Out of scope for v1 (AI assistant, advanced spam filtering)

Each requirement cites source (research finding, founder belief, or competitor gap).`;
  }

  protected async getCitations(): Promise<string[]> {
    return [
      "PRD: Letters vision and goals",
      "Research: user pain points, competitor gaps",
      "Founder belief: privacy + custom domains + indie pricing",
    ];
  }

  protected async generateGenomeWrites(
    reasoning: string,
    citations: string[]
  ): Promise<GenomeNode[]> {
    const requirements = [
      // MUST: Authentication & user management
      {
        id: "REQ-001",
        title: "User signup with email verification",
        description: "Users sign up with email address; verification email sent; account created only after verification",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "User enters email and password",
          "Verification email sent within 5 seconds",
          "Email link valid for 24 hours",
          "Account created after email verification",
        ],
      },
      {
        id: "REQ-002",
        title: "Secure login with session management",
        description: "Users log in with email/password; session cookie issued; expires after 30 days of inactivity",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Login validates credentials",
          "Session cookie issued (httpOnly, Secure, SameSite=Lax)",
          "Session persists across browser restart",
          "Session expires after 30 days inactivity",
        ],
      },
      {
        id: "REQ-003",
        title: "Password reset flow",
        description: "Users can reset forgotten passwords via email link",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Reset link sent to registered email",
          "Link valid for 1 hour",
          "New password set after clicking link",
          "Notification email sent after reset",
        ],
      },

      // MUST: Custom domain setup
      {
        id: "REQ-004",
        title: "Custom domain registration",
        description: "Users can register custom domain (e.g., user@myname.com) and verify ownership via DNS",
        priority: "must",
        source: "research_finding",
        acceptanceCriteria: [
          "User enters domain name",
          "Letters generates DNS records (MX, SPF, DKIM, DMARC)",
          "User adds DNS records to their registrar",
          "Letters verifies DNS propagation within 24 hours",
          "Domain email enabled after verification",
        ],
      },
      {
        id: "REQ-005",
        title: "Inbox with message list and reader",
        description: "Users see incoming emails; can click to read full message; view attachments",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Inbox loads in <2 seconds",
          "Displays sender, subject, date, snippet",
          "Click email to read full message",
          "View attachments; download if authorized",
          "Mobile-responsive layout",
        ],
      },
      {
        id: "REQ-006",
        title: "Email composition and sending",
        description: "Users compose emails with to/cc/bcc, subject, body; send to recipients",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Compose modal or page",
          "To/cc/bcc fields with autocomplete",
          "Subject, body, file attachment",
          "Send button validates and routes to SMTP",
          "Confirmation message after send",
        ],
      },
      {
        id: "REQ-007",
        title: "Encryption support (TLS in transit)",
        description: "All emails sent/received encrypted over TLS; optional encryption at rest",
        priority: "must",
        source: "research_finding",
        acceptanceCriteria: [
          "SMTP/IMAP connections use STARTTLS",
          "TLS 1.2 minimum",
          "Certificate validated",
          "Future: optional server-side encryption at rest",
        ],
      },
      {
        id: "REQ-008",
        title: "Email search",
        description: "Users search inbox by sender, subject, or body text",
        priority: "must",
        source: "research_finding",
        acceptanceCriteria: [
          "Search form on inbox",
          "Results return matching emails",
          "Filters: from:, subject:, body:",
          "Results paginated (20 per page)",
        ],
      },
      {
        id: "REQ-009",
        title: "Archive and trash",
        description: "Users can archive emails (remove from inbox) or trash them (soft delete)",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Archive button on email (move to 'Archive' folder)",
          "Delete button on email (move to 'Trash')",
          "Trash empties after 30 days",
          "Restore from trash within 30 days",
        ],
      },

      // MUST: Non-functional requirements
      {
        id: "REQ-010",
        title: "Performance: Inbox load time <2s",
        description: "Inbox must load and display emails in under 2 seconds (p95)",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Time to first paint: <1s",
          "Time to interactive: <2s",
          "Tested on 3G mobile network",
        ],
      },
      {
        id: "REQ-011",
        title: "Reliability: 99.9% uptime",
        description: "Letters must be available 99.9% of the time (52 minutes/month downtime allowed)",
        priority: "must",
        source: "founder_belief",
        acceptanceCriteria: [
          "Monitored 24/7 with alerting",
          "Multi-region deployment for failover",
          "Incident response SLA: 15 minutes",
        ],
      },
      {
        id: "REQ-012",
        title: "Security: No unauthorized data access",
        description: "User data protected; no unauthorized access; regular security audits",
        priority: "must",
        source: "research_finding",
        acceptanceCriteria: [
          "OWASP Top 10 covered (XSS, CSRF, SQL injection, etc.)",
          "Rate limiting on login (5 attempts/5 min)",
          "Audit logging of admin actions",
          "Annual security audit by third party",
        ],
      },

      // SHOULD: Team features (defer to v2)
      {
        id: "REQ-013",
        title: "Shared mailbox support",
        description: "Multiple team members can access shared mailbox (e.g., support@company.com)",
        priority: "should",
        source: "research_finding",
        acceptanceCriteria: [
          "Owner can add team members to mailbox",
          "Team members see all emails sent/received",
          "Can delegate specific emails to owner",
        ],
      },
      {
        id: "REQ-014",
        title: "Email forwarding",
        description: "Users can set up email forwarding (forward to another account or external email)",
        priority: "should",
        source: "research_finding",
        acceptanceCriteria: [
          "Set up forwarding rule in settings",
          "Emails forwarded to specified address",
          "Option to keep copy in original mailbox",
        ],
      },

      // COULD: Advanced features (defer to v2+)
      {
        id: "REQ-015",
        title: "Mobile app (iOS/Android)",
        description: "Native mobile app for iOS and Android",
        priority: "could",
        source: "research_finding",
        acceptanceCriteria: [
          "Offline support (can read cached emails offline)",
          "Push notifications for new email",
          "Gesture support (swipe to delete/archive)",
        ],
      },
    ];

    const nodes: GenomeNode[] = [];

    for (const req of requirements) {
      const reqNode: any = {
        id: req.id,
        type: "requirement",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: this.config.id,
        version: 1,
        title: req.title,
        description: req.description,
        source: req.source,
        sourceId: "research-findings",
        priority: req.priority,
        relatedFeatureIds: [],
        acceptanceCriteria: req.acceptanceCriteria,
      };
      nodes.push(reqNode);
    }

    return nodes;
  }
}
