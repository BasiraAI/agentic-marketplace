use anchor_lang::prelude::*;

use crate::constants::TASK_SEED;
use crate::errors::BasiraError;
use crate::state::{TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct SubmitDeliverable<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, &task_account.task_id],
        bump = task_account.bump,
    )]
    pub task_account: Account<'info, TaskAccount>,
}

pub fn submit_deliverable_handler(ctx: Context<SubmitDeliverable>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;
    let now = Clock::get()?.unix_timestamp;

    require!(
        matches!(task.status, TaskStatus::Assigned),
        BasiraError::InvalidTaskStatus
    );
    require!(now < task.deadline, BasiraError::DeadlinePassed);

    let assigned = task.assigned_agent.ok_or(BasiraError::NotAssignedAgent)?;
    require_keys_eq!(
        assigned,
        ctx.accounts.agent.key(),
        BasiraError::NotAssignedAgent
    );

    task.status = TaskStatus::Submitted;
    task.submitted_at = Some(now);

    Ok(())
}
