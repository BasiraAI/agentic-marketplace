use anchor_lang::prelude::*;

use crate::constants::{TASK_SEED, VAULT_SEED};
use crate::errors::BasiraError;
use crate::state::{Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct CancelTaskSol<'info> {
    #[account(mut, address = task_account.poster_wallet @ BasiraError::NotPoster)]
    pub poster: Signer<'info>,

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
        close = poster,
    )]
    pub vault: Account<'info, EscrowVault>,
}

pub fn cancel_task_sol_handler(ctx: Context<CancelTaskSol>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;

    require!(
        matches!(task.currency, Currency::Sol),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Created),
        BasiraError::InvalidTaskStatus
    );
    require!(
        task.assigned_agent.is_none(),
        BasiraError::AlreadyAssigned
    );

    task.status = TaskStatus::Refunded;

    Ok(())
}
