/**
 * PRODUCT GENOME SCHEMA
 * Central knowledge graph: every product decision, artifact, and relationship.
 * All agents write to and query this schema.
 */

import { z } from "zod";

// Base node type for all genome entities
const BaseNodeSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(), // agentId
  version: z.number().positive(),
});

// Vision: founder's 1-page north star
export const VisionNodeSchema = BaseNodeSchema.extend({
  type: z.literal("vision"),
  title: z.string(),
  content: z.string(), // founder's words
  keyPrinciples: z.array(z.string()),
});
export type VisionNode = z.infer<typeof VisionNodeSchema>;

// Goal: SMART objectives derived from vision
export const GoalNodeSchema = BaseNodeSchema.extend({
  type: z.literal("goal"),
  title: z.string(),
  description: z.string(),
  metrics: z.array(z.object({
    name: z.string(),
    target: z.string(),
    measurementMethod: z.string(),
  })),
  relatedVisionId: z.string().uuid(),
  priority: z.enum(["p0", "p1", "p2"]),
});
export type GoalNode = z.infer<typeof GoalNodeSchema>;

// Feature: user-facing capability
export const FeatureNodeSchema = BaseNodeSchema.extend({
  type: z.literal("feature"),
  name: z.string(),
  description: z.string(),
  userValue: z.string(), // "why users care"
  relatedGoalIds: z.array(z.string().uuid()),
  status: z.enum(["ideated", "designed", "implemented", "shipped"]),
  version: z.string(), // v1, v2, v3
});
export type FeatureNode = z.infer<typeof FeatureNodeSchema>;

// Requirement: actionable spec item
export const RequirementNodeSchema = BaseNodeSchema.extend({
  type: z.literal("requirement"),
  id: z.string().regex(/^REQ-\d+$/), // REQ-001, REQ-002, etc.
  title: z.string(),
  description: z.string(),
  source: z.enum(["research", "founder_belief", "competitor_gap", "constraint"]),
  sourceId: z.string(), // links to research finding, founder belief, etc.
  priority: z.enum(["must", "should", "could", "wont"]),
  relatedFeatureIds: z.array(z.string().uuid()),
  acceptanceCriteria: z.array(z.string()),
});
export type RequirementNode = z.infer<typeof RequirementNodeSchema>;

// Component: architectural building block
export const ComponentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("component"),
  name: z.string(),
  responsibility: z.string(),
  relatedRequirementIds: z.array(z.string()),
  relatedServiceIds: z.array(z.string().uuid()),
  interface: z.object({
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
  }),
});
export type ComponentNode = z.infer<typeof ComponentNodeSchema>;

// Service: backend service (auth, mailbox, smtp, search, admin)
export const ServiceNodeSchema = BaseNodeSchema.extend({
  type: z.literal("service"),
  name: z.string(), // auth-service, mailbox-service, smtp-service, etc.
  responsibility: z.string(),
  endpoints: z.array(z.string()), // /auth/signup, /mailbox/list, etc.
  dependencies: z.array(z.string()), // other service names
  implementationStatus: z.enum(["planned", "in_progress", "alpha", "beta", "shipped"]),
  relatedComponentIds: z.array(z.string().uuid()),
});
export type ServiceNode = z.infer<typeof ServiceNodeSchema>;

// Database: data store (PostgreSQL table, Redis key pattern, etc.)
export const DatabaseNodeSchema = BaseNodeSchema.extend({
  type: z.literal("database"),
  name: z.string(),
  dbType: z.enum(["postgres_table", "redis_key", "elasticsearch_index"]),
  schema: z.record(z.any()), // simplified schema; full SQL in artifact
  relatedServiceIds: z.array(z.string().uuid()),
  indexes: z.array(z.string()),
  archivePolicy: z.object({
    retentionDays: z.number().optional(),
    archiveDestination: z.string().optional(),
  }).optional(),
});
export type DatabaseNode = z.infer<typeof DatabaseNodeSchema>;

// API: REST/gRPC contract
export const APINodeSchema = BaseNodeSchema.extend({
  type: z.literal("api"),
  name: z.string(),
  baseUrl: z.string().optional(),
  endpoints: z.array(z.object({
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    path: z.string(),
    description: z.string(),
    requestSchema: z.record(z.any()).optional(),
    responseSchema: z.record(z.any()).optional(),
  })),
  relatedServiceIds: z.array(z.string().uuid()),
});
export type APINode = z.infer<typeof APINodeSchema>;

// Test: quality gate
export const TestNodeSchema = BaseNodeSchema.extend({
  type: z.literal("test"),
  name: z.string(),
  testType: z.enum(["unit", "integration", "e2e", "load", "security"]),
  relatedComponentIds: z.array(z.string().uuid()),
  acceptanceCriteria: z.array(z.string()),
  status: z.enum(["planned", "written", "passing", "failing"]),
});
export type TestNode = z.infer<typeof TestNodeSchema>;

// Deployment: infrastructure + rollout plan
export const DeploymentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("deployment"),
  name: z.string(),
  environment: z.enum(["local", "staging", "production"]),
  provider: z.enum(["vercel", "gcp", "aws", "docker", "kubernetes"]),
  status: z.enum(["planned", "scripted", "deployed", "live"]),
  relatedServiceIds: z.array(z.string().uuid()),
  rollbackPlan: z.string().optional(),
});
export type DeploymentNode = z.infer<typeof DeploymentNodeSchema>;

// Research finding: competitive intelligence, market insight, risk
export const ResearchFindingNodeSchema = BaseNodeSchema.extend({
  type: z.literal("research"),
  category: z.enum(["competitor", "market", "user_pain", "trend", "patent", "system_model"]),
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string()), // citations, links
  implication: z.string(), // "what does this mean for Letters?"
  relatedRequirementIds: z.array(z.string()),
});
export type ResearchFindingNode = z.infer<typeof ResearchFindingNodeSchema>;

// Decision: why a choice was made
export const DecisionNodeSchema = BaseNodeSchema.extend({
  type: z.literal("decision"),
  title: z.string(),
  context: z.string(),
  options: z.array(z.object({
    name: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  })),
  chosen: z.string(), // which option was picked
  reasoning: z.string(),
  tradeoffs: z.string(), // what we're giving up
  relatedRequirementIds: z.array(z.string()),
});
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;

// Risk: threat to success
export const RiskNodeSchema = BaseNodeSchema.extend({
  type: z.literal("risk"),
  title: z.string(),
  description: z.string(),
  probability: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  mitigation: z.string(),
  owner: z.string(), // agentId or human
});
export type RiskNode = z.infer<typeof RiskNodeSchema>;

// Full genome union type
export const GenomeNodeSchema = z.union([
  VisionNodeSchema,
  GoalNodeSchema,
  FeatureNodeSchema,
  RequirementNodeSchema,
  ComponentNodeSchema,
  ServiceNodeSchema,
  DatabaseNodeSchema,
  APINodeSchema,
  TestNodeSchema,
  DeploymentNodeSchema,
  ResearchFindingNodeSchema,
  DecisionNodeSchema,
  RiskNodeSchema,
]);
export type GenomeNode = z.infer<typeof GenomeNodeSchema>;

// Relationship between genome nodes (e.g., feature → requirement, service → database)
export const GenomeRelationshipSchema = z.object({
  id: z.string().uuid(),
  fromNodeId: z.string(),
  fromType: z.string(),
  toNodeId: z.string(),
  toType: z.string(),
  relationType: z.string(), // "requires", "implements", "contains", "depends_on", etc.
  createdAt: z.date(),
});
export type GenomeRelationship = z.infer<typeof GenomeRelationshipSchema>;

// Full genome state
export const GenomeSchema = z.object({
  vision: VisionNodeSchema.optional(),
  goals: z.array(GoalNodeSchema),
  features: z.array(FeatureNodeSchema),
  requirements: z.array(RequirementNodeSchema),
  components: z.array(ComponentNodeSchema),
  services: z.array(ServiceNodeSchema),
  databases: z.array(DatabaseNodeSchema),
  apis: z.array(APINodeSchema),
  tests: z.array(TestNodeSchema),
  deployments: z.array(DeploymentNodeSchema),
  research: z.array(ResearchFindingNodeSchema),
  decisions: z.array(DecisionNodeSchema),
  risks: z.array(RiskNodeSchema),
  relationships: z.array(GenomeRelationshipSchema),
});
export type Genome = z.infer<typeof GenomeSchema>;
