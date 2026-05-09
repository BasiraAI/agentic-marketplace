import { z } from "zod";

// --- Enums ---
export const CurrencySchema = z.enum(["SOL", "USDC"]);
export const TaskModeSchema = z.enum(["direct", "bounty"]);
export const TaskStatusSchema = z.enum([
  "created",
  "assigned",
  "submitted",
  "approved",
  "disputed",
  "settled",
  "refunded",
  "expired",
]);
export const AgentStatusSchema = z.enum(["active", "inactive"]);
export const PosterKindSchema = z.enum(["human", "registered_agent", "outside_agent"]);

// --- Models ---
export const AgentSchema = z.object({
  wallet: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.string(),
  capability_tags: z.array(z.string()),
  endpoint_url: z.string().url(),
  comms_modes: z.array(z.enum(["webhook", "mcp", "polling"])),
  max_response_seconds: z.number().int().default(60),
  default_max_delivery_seconds: z.number().int().default(3600),
  supported_currencies: z.array(CurrencySchema),
  min_task_reward_usdc: z.number(),
  status: AgentStatusSchema,
  last_health_check_at: z.date().nullable(),
  created_at: z.date(),
});

export const TaskSchema = z.object({
  task_id: z.string().uuid(),
  poster_wallet: z.string(),
  poster_kind: PosterKindSchema,
  assigned_agent: z.string().nullable(),
  mode: TaskModeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  currency: CurrencySchema,
  amount: z.number().positive(),
  deadline: z.date(),
  status: TaskStatusSchema,
  created_at: z.date(),
  submitted_at: z.date().nullable(),
  settled_at: z.date().nullable(),
});

export const BountyApplicationSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  agent_wallet: z.string(),
  message: z.string().max(500),
  status: z.enum(["pending", "accepted", "rejected", "withdrawn"]),
  created_at: z.date(),
});

export const DeliverableSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  agent_wallet: z.string(),
  content_text: z.string(),
  file_urls: z.array(z.string().url()),
  submitted_at: z.date(),
});

export const VerdictSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  verdict: z.enum(["pass", "fail", "unavailable"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  failed_criteria: z.array(z.number().int()),
  model: z.string(),
  prompt_version: z.string(),
  created_at: z.date(),
});

export const DisputeSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  opened_by: z.string(), // wallet or 'auto'
  reason: z.string(),
  agent_response: z.string().nullable(),
  ruling: z.enum(["agent", "poster"]).nullable(),
  ruling_notes: z.string().nullable(),
  opened_at: z.date(),
  resolved_at: z.date().nullable(),
  agent_responded_at: z.date().nullable(),
});

export const SettlementSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  kind: z.enum(["release", "refund", "fee"]),
  recipient_wallet: z.string(),
  currency: CurrencySchema,
  amount: z.number(),
  tx_signature: z.string(),
  created_at: z.date(),
});

export const WebhookDeliverySchema = z.object({
  id: z.string().uuid(),
  agent_wallet: z.string(),
  event: z.string(),
  payload: z.any(),
  status: z.enum(["pending", "delivered", "failed"]),
  attempts: z.number().int(),
  last_error: z.string().nullable(),
  created_at: z.date(),
  delivered_at: z.date().nullable(),
});

// --- API Request/Response Schemas ---
export const CreateTaskRequestSchema = z.object({
  mode: TaskModeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  currency: CurrencySchema,
  amount: z.number().positive(),
  deadline: z.string().datetime(), // ISO string from client
  assigned_agent: z.string().optional(), // Required if mode = direct
});
