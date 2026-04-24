import { ApolloServer } from "@apollo/server";
import fastifyApollo, { fastifyApolloDrainPlugin } from "@as-integrations/fastify";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { buildContext, type GraphQLContext } from "./graphql/context.js";
import { resolvers, typeDefs } from "./graphql/schema.js";
import { registerAuthRoute } from "./modules/auth/auth.route.js";
import { registerNotificationBatchRoute } from "./modules/notification-batch/notification-batch.route.js";
import { registerStatsCommentaryRoute } from "./modules/stats/stats-commentary.route.js";
import { getBearerToken, resolveUserIdFromSessionToken } from "./common/auth/session.js";

const PROTECTED_ROUTE_PREFIXES = ["/graphql", "/api/"] as const;
const AUTH_EXEMPT_ROUTES = ["/api/notifications/batch/run"] as const;
const DEV_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] as const;

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function resolveCorsAllowlist() {
  const rawOrigins = [
    env.WEB_UI_ORIGIN,
    ...env.CORS_ALLOWED_ORIGINS,
    ...(process.env.NODE_ENV === "production" ? [] : DEV_ALLOWED_ORIGINS),
  ];

  return new Set(rawOrigins.map((origin) => normalizeOrigin(origin)));
}

function shouldProtectRequest(url: string, method: string) {
  if (method === "OPTIONS") {
    return false;
  }

  if (!PROTECTED_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return false;
  }

  if (AUTH_EXEMPT_ROUTES.some((prefix) => url.startsWith(prefix))) {
    return false;
  }

  return true;
}

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
  const corsAllowlist = resolveCorsAllowlist();

  await apollo.start();

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (normalizedOrigin === "null") {
        callback(null, env.CORS_ALLOW_NULL_ORIGIN);
        return;
      }

      callback(null, corsAllowlist.has(normalizedOrigin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-batch-secret"],
    maxAge: 60 * 60 * 24,
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!shouldProtectRequest(request.url, request.method)) {
      return;
    }

    const token = getBearerToken(request);
    if (!token) {
      return reply.code(401).send({
        message: "로그인이 필요해요.",
      });
    }

    const userId = await resolveUserIdFromSessionToken(token, {
      refreshExpiresAt: false,
    });

    if (!userId) {
      return reply.code(401).send({
        message: "세션이 만료되었어요. 다시 로그인해 주세요.",
      });
    }
  });

  await app.register(fastifyApollo(apollo), {
    path: "/graphql",
    context: async (request, reply) => buildContext(request, reply),
  });

  await registerStatsCommentaryRoute(app);
  await registerNotificationBatchRoute(app);
  await registerAuthRoute(app);

  return app;
}
