/**
 * MCP SERVER
 * REST API for Forge framework.
 * Exposes: genome CRUD, agent orchestration, session status.
 */

import * as http from "http";
import * as url from "url";
import { getGenomeStore } from "./genome-store";
import { GenomeNode, GenomeSchema } from "./genome.schema";
import { v4 as uuidv4 } from "uuid";

interface Response {
  status: number;
  body: any;
}

export class MCPServer {
  private port: number;
  private server: http.Server | null = null;

  constructor(port = 3333) {
    this.port = port;
  }

  /**
   * Start the MCP server.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const response = await this.route(req);
          res.writeHead(response.status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response.body, null, 2));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: message }, null, 2));
        }
      });

      this.server.listen(this.port, () => {
        console.log(`[MCPServer] Listening on http://localhost:${this.port}`);
        resolve();
      });

      this.server.on("error", reject);
    });
  }

  /**
   * Stop the MCP server.
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Route incoming requests to handlers.
   */
  private async route(req: http.IncomingMessage): Promise<Response> {
    const parsed = url.parse(req.url || "", true);
    const pathname = parsed.pathname || "";
    const method = req.method || "GET";

    // Health check
    if (pathname === "/" && method === "GET") {
      return { status: 200, body: { status: "ok", service: "forge-mcp-server" } };
    }

    // Genome endpoints
    if (pathname.startsWith("/genome")) {
      if (pathname === "/genome" && method === "GET") {
        return await this.getGenome();
      }
      if (pathname === "/genome/vision" && method === "GET") {
        return await this.getVision();
      }
      if (pathname === "/genome/vision" && method === "POST") {
        return await this.createVision(req);
      }
      if (pathname === "/genome/goals" && method === "GET") {
        return await this.getGoals();
      }
      if (pathname === "/genome/goals" && method === "POST") {
        return await this.createGoal(req);
      }
      if (pathname === "/genome/requirements" && method === "GET") {
        return await this.getRequirements();
      }
      if (pathname === "/genome/requirements" && method === "POST") {
        return await this.createRequirement(req);
      }
      if (pathname === "/genome/services" && method === "GET") {
        return await this.getServices();
      }
      if (pathname === "/genome/services" && method === "POST") {
        return await this.createService(req);
      }
      if (pathname === "/genome/relationships" && method === "POST") {
        return await this.createRelationship(req);
      }
      if (pathname.match(/^\/genome\/node\//) && method === "GET") {
        const nodeId = pathname.split("/").pop();
        return await this.getNode(nodeId);
      }
    }

    // Health with readiness check
    if (pathname === "/health" && method === "GET") {
      return { status: 200, body: { ready: true, timestamp: new Date().toISOString() } };
    }

    return { status: 404, body: { error: "Not Found" } };
  }

  /**
   * GET /genome
   * Return full genome.
   */
  private async getGenome(): Promise<Response> {
    const store = await getGenomeStore();
    const genome = store.getGenome();
    return { status: 200, body: genome };
  }

  /**
   * GET /genome/vision
   */
  private async getVision(): Promise<Response> {
    const store = await getGenomeStore();
    const nodes = store.getNodesByType("vision");
    return { status: 200, body: nodes[0] || null };
  }

  /**
   * POST /genome/vision
   */
  private async createVision(req: http.IncomingMessage): Promise<Response> {
    const body = await this.readBody(req);
    const node = {
      id: uuidv4(),
      type: "vision" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: body.createdBy || "system",
      version: 1,
      title: body.title,
      content: body.content,
      keyPrinciples: body.keyPrinciples || [],
    };

    const store = await getGenomeStore();
    await store.upsertNode(node);
    return { status: 201, body: node };
  }

  /**
   * GET /genome/goals
   */
  private async getGoals(): Promise<Response> {
    const store = await getGenomeStore();
    const nodes = store.getNodesByType("goal");
    return { status: 200, body: nodes };
  }

  /**
   * POST /genome/goals
   */
  private async createGoal(req: http.IncomingMessage): Promise<Response> {
    const body = await this.readBody(req);
    const node = {
      id: uuidv4(),
      type: "goal" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: body.createdBy || "system",
      version: 1,
      title: body.title,
      description: body.description,
      metrics: body.metrics || [],
      relatedVisionId: body.relatedVisionId || "",
      priority: body.priority || "p1",
    };

    const store = await getGenomeStore();
    await store.upsertNode(node);
    return { status: 201, body: node };
  }

  /**
   * GET /genome/requirements
   */
  private async getRequirements(): Promise<Response> {
    const store = await getGenomeStore();
    const nodes = store.getNodesByType("requirement");
    return { status: 200, body: nodes };
  }

  /**
   * POST /genome/requirements
   */
  private async createRequirement(req: http.IncomingMessage): Promise<Response> {
    const body = await this.readBody(req);
    const node = {
      id: body.id || `REQ-${String(Math.random()).slice(2, 5)}`,
      type: "requirement" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: body.createdBy || "system",
      version: 1,
      title: body.title,
      description: body.description,
      source: body.source || "requirement",
      sourceId: body.sourceId || "",
      priority: body.priority || "should",
      relatedFeatureIds: body.relatedFeatureIds || [],
      acceptanceCriteria: body.acceptanceCriteria || [],
    };

    const store = await getGenomeStore();
    await store.upsertNode(node);
    return { status: 201, body: node };
  }

  /**
   * GET /genome/services
   */
  private async getServices(): Promise<Response> {
    const store = await getGenomeStore();
    const nodes = store.getNodesByType("service");
    return { status: 200, body: nodes };
  }

  /**
   * POST /genome/services
   */
  private async createService(req: http.IncomingMessage): Promise<Response> {
    const body = await this.readBody(req);
    const node = {
      id: uuidv4(),
      type: "service" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: body.createdBy || "system",
      version: 1,
      name: body.name,
      responsibility: body.responsibility,
      endpoints: body.endpoints || [],
      dependencies: body.dependencies || [],
      implementationStatus: body.implementationStatus || "planned",
      relatedComponentIds: body.relatedComponentIds || [],
    };

    const store = await getGenomeStore();
    await store.upsertNode(node);
    return { status: 201, body: node };
  }

  /**
   * POST /genome/relationships
   */
  private async createRelationship(req: http.IncomingMessage): Promise<Response> {
    const body = await this.readBody(req);
    const store = await getGenomeStore();
    const rel = await store.createRelationship(
      body.fromNodeId,
      body.toNodeId,
      body.relationType
    );
    return { status: 201, body: rel };
  }

  /**
   * GET /genome/node/:id
   */
  private async getNode(nodeId?: string): Promise<Response> {
    if (!nodeId) {
      return { status: 400, body: { error: "Missing node ID" } };
    }

    const store = await getGenomeStore();
    const node = store.getNode(nodeId);

    if (!node) {
      return { status: 404, body: { error: `Node not found: ${nodeId}` } };
    }

    return { status: 200, body: node };
  }

  /**
   * Parse request body as JSON.
   */
  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }
}

/**
 * Start the server if run directly.
 */
if (require.main === module) {
  const port = parseInt(process.env.FORGE_API_PORT || "3333");
  const server = new MCPServer(port);

  server.start().catch((err) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down gracefully...");
    await server.stop();
    process.exit(0);
  });
}
