use anchor_lang::prelude::*;

use crate::constants::{AGENT_SEED, TASK_SEED, VAULT_SEED};
use crate::errors::BasiraError;
use crate::state::{AgentAccount, Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct ExpireTaskSol<'info> {
    pub caller: Signer<'info>,

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

    /// CHECK: address-bound to receive the full refund.
    #[account(mut, address = task_account.poster_wallet)]
    pub poster_wallet: UncheckedAccount<'info>,

    /// Optional agent account — present only when an agent was assigned. The
    /// caller is responsible for passing it; the program enforces that, when
    /// `task.assigned_agent` is Some, this account exists and matches.
    #[account(
        mut,
        seeds = [AGENT_SEED, agent_account.wallet.as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Option<Account<'info, AgentAccount>>,
}

pub fn expire_task_sol_handler(ctx: Context<ExpireTaskSol>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;
    let now = Clock::get()?.unix_timestamp;

    require!(
        matches!(task.currency, Currency::Sol),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Created | TaskStatus::Assigned),
        BasiraError::InvalidTaskStatus
    );
    require!(now >= task.deadline, BasiraError::DeadlineTooSoon);

    if let Some(assigned) = task.assigned_agent {
        let agent = ctx
            .accounts
            .agent_account
            .as_mut()
            .ok_or(BasiraError::MissingRecipientAccount)?;
        require_keys_eq!(agent.wallet, assigned, BasiraError::AgentAccountMismatch);

        agent.disputed_count = agent
            .disputed_count
            .checked_add(1)
            .ok_or(BasiraError::NumericOverflow)?;
    }

    task.status = TaskStatus::Expired;

    Ok(())
}
