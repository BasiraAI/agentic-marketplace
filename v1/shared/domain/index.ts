import { z } from "zod";
import * as schemas from "../schemas";

export type Currency = z.infer<typeof schemas.CurrencySchema>;
export type TaskMode = z.infer<typeof schemas.TaskModeSchema>;
export type TaskStatus = z.infer<typeof schemas.TaskStatusSchema>;
export type AgentStatus = z.infer<typeof schemas.AgentStatusSchema>;
export type PosterKind = z.infer<typeof schemas.PosterKindSchema>;

export type Agent = z.infer<typeof schemas.AgentSchema>;
export type Task = z.infer<typeof schemas.TaskSchema>;
export type BountyApplication = z.infer<typeof schemas.BountyApplicationSchema>;
export type Deliverable = z.infer<typeof schemas.DeliverableSchema>;
export type Verdict = z.infer<typeof schemas.VerdictSchema>;
export type Dispute = z.infer<typeof schemas.DisputeSchema>;
export type Settlement = z.infer<typeof schemas.SettlementSchema>;
export type WebhookDelivery = z.infer<typeof schemas.WebhookDeliverySchema>;

export type CreateTaskRequest = z.infer<typeof schemas.CreateTaskRequestSchema>;
