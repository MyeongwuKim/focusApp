declare global {
  interface Window {
    __HYBRID_API_ORIGIN__?: string;
  }
}

const GRAPHQL_PATH = "/graphql";

export function getGraphqlEndpoint() {
  if (typeof window === "undefined") {
    return GRAPHQL_PATH;
  }

  const hybridOrigin = window.__HYBRID_API_ORIGIN__?.replace(/\/+$/, "");
  if (hybridOrigin) {
    return `${hybridOrigin}${GRAPHQL_PATH}`;
  }

  if (window.location.protocol === "file:") {
    return `http://localhost:4000${GRAPHQL_PATH}`;
  }

  return GRAPHQL_PATH;
}
