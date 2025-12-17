import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    kafkaProducer?: any;
  }
}
