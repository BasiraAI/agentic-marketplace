use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{AGENT_SEED, TASK_SEED, VAULT_SEED};
use crate::errors::BasiraError;
use crate::instructions::shared::{vault_token_close, vault_token_transfer};
use crate::state::{AgentAccount, Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct ExpireTaskUsdc<'info> {
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

    /// CHECK: address-bound to receive the refund.
    #[account(mut, address = task_account.poster_wallet)]
    pub poster_wallet: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = poster_wallet,
    )]
    pub poster_token_account: Account<'info, TokenAccount>,

    /// Optional: present only when an agent was assigned (to take the penalty).
    #[account(
        mut,
        seeds = [AGENT_SEED, agent_account.wallet.as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Option<Account<'info, AgentAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn expire_task_usdc_handler(ctx: Context<ExpireTaskUsdc>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;
    let now = Clock::get()?.unix_timestamp;

    require!(
        matches!(task.currency, Currency::Usdc),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Created | TaskStatus::Assigned),
        BasiraError::InvalidTaskStatus
    );
    require!(now >= task.deadline, BasiraError::DeadlineTooSoon);

    let task_id = task.task_id;
    let vault_bump = ctx.accounts.vault.bump;
    let amount = task.amount;

    vault_token_transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.poster_token_account.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
        amount,
    )?;

    vault_token_close(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.poster_wallet.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
    )?;

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
