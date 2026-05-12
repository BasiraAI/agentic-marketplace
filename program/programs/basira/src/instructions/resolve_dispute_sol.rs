use anchor_lang::prelude::*;

use crate::constants::{AGENT_SEED, ARBITRATOR_KEY, TASK_SEED, TREASURY, VAULT_SEED};
use crate::errors::BasiraError;
use crate::instructions::shared::{pay_from_program_owned, split_amount};
use crate::state::{AgentAccount, Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DisputeRuling {
    ForAgent,
    ForPoster,
}

#[derive(Accounts)]
pub struct ResolveDisputeSol<'info> {
    #[account(address = ARBITRATOR_KEY @ BasiraError::NotArbitrator)]
    pub arbitrator: Signer<'info>,

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

    /// CHECK: address-bound to the task's poster_wallet.
    #[account(mut, address = task_account.poster_wallet)]
    pub poster_wallet: UncheckedAccount<'info>,

    /// CHECK: address-bound to the task's assigned_agent.
    #[account(mut, address = task_account.assigned_agent.unwrap_or_default())]
    pub agent_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [AGENT_SEED, agent_wallet.key().as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Account<'info, AgentAccount>,

    /// CHECK: hardcoded program treasury.
    #[account(mut, address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,
}

pub fn resolve_dispute_sol_handler(
    ctx: Context<ResolveDisputeSol>,
    ruling: DisputeRuling,
) -> Result<()> {
    let task = &mut ctx.accounts.task_account;

    require!(
        matches!(task.currency, Currency::Sol),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Disputed),
        BasiraError::InvalidTaskStatus
    );

    match ruling {
        DisputeRuling::ForAgent => {
            let (agent_amount, fee_amount) = split_amount(task.amount, task.fee_bps)?;
            pay_from_program_owned(
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.agent_wallet.to_account_info(),
                agent_amount,
            )?;
            pay_from_program_owned(
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.treasury.to_account_info(),
                fee_amount,
            )?;

            let agent = &mut ctx.accounts.agent_account;
            agent.completed_count = agent
                .completed_count
                .checked_add(1)
                .ok_or(BasiraError::NumericOverflow)?;

            task.status = TaskStatus::Settled;
        }
        DisputeRuling::ForPoster => {
            pay_from_program_owned(
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.poster_wallet.to_account_info(),
                task.amount,
            )?;

            let agent = &mut ctx.accounts.agent_account;
            agent.disputed_count = agent
                .disputed_count
                .checked_add(1)
                .ok_or(BasiraError::NumericOverflow)?;

            task.status = TaskStatus::Refunded;
        }
    }

    Ok(())
}
