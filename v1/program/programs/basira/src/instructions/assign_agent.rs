use anchor_lang::prelude::*;

use crate::constants::{AGENT_SEED, TASK_SEED};
use crate::errors::BasiraError;
use crate::state::{AgentAccount, TaskAccount, TaskMode, TaskStatus};

#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(address = task_account.poster_wallet @ BasiraError::NotPoster)]
    pub poster: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, &task_account.task_id],
        bump = task_account.bump,
    )]
    pub task_account: Account<'info, TaskAccount>,

    #[account(
        seeds = [AGENT_SEED, agent_account.wallet.as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Account<'info, AgentAccount>,
}

pub fn assign_agent_handler(ctx: Context<AssignAgent>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;

    require!(
        matches!(task.mode, TaskMode::Bounty),
        BasiraError::InvalidTaskStatus
    );
    require!(
        matches!(task.status, TaskStatus::Created),
        BasiraError::InvalidTaskStatus
    );
    require!(
        task.assigned_agent.is_none(),
        BasiraError::AlreadyAssigned
    );

    task.assigned_agent = Some(ctx.accounts.agent_account.wallet);
    task.status = TaskStatus::Assigned;

    Ok(())
}
