import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: any,
      reply: any
    ) => Promise<void> | void;

    rateLimitMap: Map<
      string,
      {
        count: number;
        ts: number;
      }
    >;
  }

  interface FastifyRequest {
    user?: {
      workspace_id: number;
      api_key_label: string | null;
    };
  }
}
