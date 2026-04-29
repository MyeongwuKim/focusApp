import { ApolloServer } from "@apollo/server";
import type { ApolloServerPlugin, GraphQLRequestContextDidEncounterErrors } from "@apollo/server";
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
import { captureGraphQLError, captureServerError, resolveErrorCode } from "./common/observability/sentry.js";

const PROTECTED_ROUTE_PREFIXES = ["/graphql", "/api/"] as const;
const AUTH_EXEMPT_ROUTES = ["/api/notifications/batch/run"] as const;
const DEV_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] as const;
const requestStartedAtMap = new WeakMap<object, number>();
const authenticatedUserIdMap = new WeakMap<object, string>();

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

function getRouteLabel(url: string) {
  return url.split("?")[0] ?? url;
}

function createGraphqlSentryPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async didEncounterErrors(context: GraphQLRequestContextDidEncounterErrors<GraphQLContext>) {
          const requestId = context.contextValue?.request.id ?? "unknown";
          const route = context.contextValue?.request.url
            ? getRouteLabel(context.contextValue.request.url)
            : "/graphql";
          const userId = context.contextValue?.userId ?? null;
          const operationName = context.request.operationName ?? null;

          for (const error of context.errors) {
            captureGraphQLError(error, {
              requestId,
              route,
              operationName,
              userId,
              variables: context.request.variables,
            });
          }
        },
      };
    },
  };
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
    plugins: [fastifyApolloDrainPlugin(app), createGraphqlSentryPlugin()],
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

  app.addHook("onRequest", async (request) => {
    requestStartedAtMap.set(request, Date.now());
    request.log.info({
      requestId: request.id,
      method: request.method,
      route: getRouteLabel(request.url),
    }, "request_start");
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!shouldProtectRequest(request.url, request.method)) {
      return;
    }

    const token = getBearerToken(request);
    if (!token) {
      request.log.warn({
        requestId: request.id,
        method: request.method,
        route: getRouteLabel(request.url),
        userId: null,
        statusCode: 401,
        errorCode: "UNAUTHORIZED_MISSING_TOKEN",
      }, "request_unauthorized");
      return reply.code(401).send({
        message: "로그인이 필요해요.",
      });
    }

    const userId = await resolveUserIdFromSessionToken(token, {
      refreshExpiresAt: false,
    });

    if (!userId) {
      request.log.warn({
        requestId: request.id,
        method: request.method,
        route: getRouteLabel(request.url),
        userId: null,
        statusCode: 401,
        errorCode: "UNAUTHORIZED_SESSION_EXPIRED",
      }, "request_unauthorized");
      return reply.code(401).send({
        message: "세션이 만료되었어요. 다시 로그인해 주세요.",
      });
    }

    authenticatedUserIdMap.set(request, userId);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    const route = getRouteLabel(request.url);
    const userId = authenticatedUserIdMap.get(request) ?? null;
    const errorCode = resolveErrorCode(error);

    request.log.error({
      requestId: request.id,
      method: request.method,
      route,
      userId,
      statusCode,
      errorCode,
      err: error,
    }, "request_error");

    captureServerError(error, {
      requestId: request.id,
      method: request.method,
      route,
      userId,
      statusCode,
      errorCode,
      requestInput: {
        body: request.body,
        query: request.query,
        params: request.params,
      },
    });

    reply.status(statusCode).send(error);
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAtMs = requestStartedAtMap.get(request);
    const latencyMs = startedAtMs ? Date.now() - startedAtMs : null;

    request.log.info({
      requestId: request.id,
      method: request.method,
      route: getRouteLabel(request.url),
      userId: authenticatedUserIdMap.get(request) ?? null,
      statusCode: reply.statusCode,
      latencyMs,
    }, "request_complete");
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
