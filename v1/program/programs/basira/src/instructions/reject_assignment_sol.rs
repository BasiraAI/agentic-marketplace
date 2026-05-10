use anchor_lang::prelude::*;

use crate::constants::{TASK_SEED, VAULT_SEED};
use crate::errors::BasiraError;
use crate::state::{Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct RejectAssignmentSol<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, &task_account.task_id],
        bump = task_account.bump,
    )]
    pub task_account: Account<'info, TaskAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, &task_account.task_id],
        bump = vault.bump,
        close = poster_wallet,
    )]
    pub vault: Account<'info, EscrowVault>,

    /// CHECK: address-bound to the task's poster_wallet so refund goes to the right place.
    #[account(mut, address = task_account.poster_wallet)]
    pub poster_wallet: UncheckedAccount<'info>,
}

pub fn reject_assignment_sol_handler(ctx: Context<RejectAssignmentSol>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;

    require!(
        matches!(task.currency, Currency::Sol),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Assigned),
        BasiraError::InvalidTaskStatus
    );
    require!(task.submitted_at.is_none(), BasiraError::InvalidTaskStatus);

    let assigned = task.assigned_agent.ok_or(BasiraError::NotAssignedAgent)?;
    require_keys_eq!(
        assigned,
        ctx.accounts.agent.key(),
        BasiraError::NotAssignedAgent
    );

    task.status = TaskStatus::Refunded;

    Ok(())
}
