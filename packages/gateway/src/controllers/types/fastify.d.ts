import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
    rateLimitMap: Map<string, any>;
  }

  interface FastifyRequest {
    apiKey?: {
      workspace_id: number;
      label: string;
    };
  }
}
