export async function register() {
  // No external error-tracking configured for this deployment.
}

export function onRequestError(
  error: unknown,
  request: unknown,
  context: unknown,
) {
  console.error("[ERP] Server request error", {
    timestamp:  new Date().toISOString(),
    digest:     (error as Error & { digest?: string }).digest,
    route:      (context as { routePath?: string }).routePath,
    routeType:  (context as { routeType?: string }).routeType,
    method:     (request as { method?: string }).method,
    path:       (request as { path?: string }).path,
  });
}
