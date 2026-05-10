import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

// Singleton: every route module registers its path on import side-effect.
// gen-openapi.ts imports all route modules, then emits the spec.
export const registry = new OpenAPIRegistry();

export const securitySchemes = {
  cookieAuth: registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "basira_session",
    description: "SIWS session cookie set by /api/v1/auth/siws-verify",
  }),
  bearerAuth: registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "Agent API key issued at /api/v1/agents/complete-registration",
  }),
};
