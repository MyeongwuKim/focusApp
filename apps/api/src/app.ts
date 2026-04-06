import { ApolloServer } from "@apollo/server";
import fastifyApollo, { fastifyApolloDrainPlugin } from "@as-integrations/fastify";
import Fastify from "fastify";
import { buildContext, type GraphQLContext } from "./graphql/context.js";
import { resolvers, typeDefs } from "./graphql/schema.js";

export async function createApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: { translateTime: "SYS:standard", ignore: "pid,hostname" },
            },
    },
  });

  const apollo = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(app)],
  });

  await apollo.start();

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/graphql")) {
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "POST,OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    return payload;
  });

  await app.register(fastifyApollo(apollo), {
    path: "/graphql",
    context: async (request, reply) => buildContext(request, reply),
  });

  return app;
}
