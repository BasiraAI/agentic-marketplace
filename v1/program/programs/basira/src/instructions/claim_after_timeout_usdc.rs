use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{AGENT_SEED, AUTO_RELEASE_SECONDS, TASK_SEED, TREASURY, VAULT_SEED};
use crate::errors::BasiraError;
use crate::instructions::shared::{split_amount, vault_token_close, vault_token_transfer};
use crate::state::{AgentAccount, Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct ClaimAfterTimeoutUsdc<'info> {
    #[account(mut)]
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

    /// CHECK: address-bound to receive vault rent.
    #[account(mut, address = task_account.poster_wallet)]
    pub poster_wallet: UncheckedAccount<'info>,

    /// CHECK: address-bound to the task's assigned_agent.
    #[account(address = task_account.assigned_agent.unwrap_or_default())]
    pub agent_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [AGENT_SEED, agent_wallet.key().as_ref()],
        bump = agent_account.bump,
    )]
    pub agent_account: Account<'info, AgentAccount>,

    /// CHECK: hardcoded program treasury.
    #[account(address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = usdc_mint,
        associated_token::authority = agent_wallet,
    )]
    pub agent_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn claim_after_timeout_usdc_handler(ctx: Context<ClaimAfterTimeoutUsdc>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;
    let now = Clock::get()?.unix_timestamp;

    require!(
        matches!(task.currency, Currency::Usdc),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Submitted),
        BasiraError::InvalidTaskStatus
    );

    let submitted_at = task.submitted_at.ok_or(BasiraError::InvalidTaskStatus)?;
    require!(
        now >= submitted_at.saturating_add(AUTO_RELEASE_SECONDS),
        BasiraError::TimeoutNotElapsed
    );

    let (agent_amount, fee_amount) = split_amount(task.amount, task.fee_bps)?;
    let task_id = task.task_id;
    let vault_bump = ctx.accounts.vault.bump;

    vault_token_transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.agent_token_account.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
        agent_amount,
    )?;

    vault_token_transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.treasury_token_account.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
        fee_amount,
    )?;

    vault_token_close(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.poster_wallet.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
    )?;

    let agent = &mut ctx.accounts.agent_account;
    agent.completed_count = agent
        .completed_count
        .checked_add(1)
        .ok_or(BasiraError::NumericOverflow)?;

    task.status = TaskStatus::Settled;

    Ok(())
}
