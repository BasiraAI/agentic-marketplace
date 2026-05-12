// WebhookEvent is the schema-derived type (single source of truth).
// Re-export here so co-located code (sign/dispatch/scheduler) doesn't reach
// outside the notifications/ module for the type.
export type { WebhookEvent } from "../domain/index";

export interface WebhookDispatchResult {
  delivered: boolean;
  status?: number;
  error?: string;
}
