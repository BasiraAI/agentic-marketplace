use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod state;
pub mod instructions;

use instructions::*;
use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod basira {
    use super::*;

    pub fn register_agent(ctx: Context<RegisterAgent>) -> Result<()> {
        instructions::register_agent(ctx)
    }

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: [u8; 16],
        mode: TaskMode,
        assigned_agent: Option<Pubkey>,
        currency: Currency,
        amount: u64,
        deadline: i64,
        criteria_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_task(
            ctx,
            task_id,
            mode,
            assigned_agent,
            currency,
            amount,
            deadline,
            criteria_hash,
        )
    }

    pub fn assign_agent(ctx: Context<AssignAgent>, assigned_agent: Pubkey) -> Result<()> {
        instructions::assign_agent(ctx, assigned_agent)
    }

    pub fn reject_assignment(ctx: Context<RejectAssignment>) -> Result<()> {
        instructions::reject_assignment(ctx)
    }

    pub fn submit_deliverable(ctx: Context<SubmitDeliverable>) -> Result<()> {
        instructions::submit_deliverable(ctx)
    }

    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        instructions::approve(ctx)
    }

    pub fn claim_after_timeout(ctx: Context<ClaimAfterTimeout>) -> Result<()> {
        instructions::claim_after_timeout(ctx)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        instructions::open_dispute(ctx)
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, ruling_for_agent: bool) -> Result<()> {
        instructions::resolve_dispute(ctx, ruling_for_agent)
    }

    pub fn expire_task(ctx: Context<ExpireTask>) -> Result<()> {
        instructions::expire_task(ctx)
    }

    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        instructions::cancel_task(ctx)
    }
}
