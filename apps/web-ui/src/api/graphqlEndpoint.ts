declare global {
  interface Window {
    __HYBRID_API_ORIGIN__?: string;
  }
}

const GRAPHQL_PATH = "/graphql";

export function getApiOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  const envApiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (envApiOrigin) {
    return envApiOrigin.replace(/\/+$/, "");
  }

  const hybridOrigin = window.__HYBRID_API_ORIGIN__?.replace(/\/+$/, "");
  if (hybridOrigin) {
    return hybridOrigin;
  }

  if (window.location.protocol === "file:") {
    return "http://localhost:4000";
  }

  return "";
}

export function getGraphqlEndpoint() {
  if (typeof window === "undefined") {
    return GRAPHQL_PATH;
  }

  const apiOrigin = getApiOrigin();
  if (apiOrigin) {
    return `${apiOrigin}${GRAPHQL_PATH}`;
  }

  return GRAPHQL_PATH;
}
