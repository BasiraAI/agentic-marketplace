use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{TASK_SEED, VAULT_SEED};
use crate::errors::BasiraError;
use crate::instructions::shared::{vault_token_close, vault_token_transfer};
use crate::state::{Currency, EscrowVault, TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct CancelTaskUsdc<'info> {
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
        associated_token::authority = poster,
    )]
    pub poster_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn cancel_task_usdc_handler(ctx: Context<CancelTaskUsdc>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;

    require!(
        matches!(task.currency, Currency::Usdc),
        BasiraError::CurrencyMismatch
    );
    require!(
        matches!(task.status, TaskStatus::Created),
        BasiraError::InvalidTaskStatus
    );
    require!(task.assigned_agent.is_none(), BasiraError::AlreadyAssigned);

    let task_id = task.task_id;
    let vault_bump = ctx.accounts.vault.bump;

    vault_token_transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.poster_token_account.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
        task.amount,
    )?;

    vault_token_close(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault_token_account.to_account_info(),
        &ctx.accounts.poster.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &task_id,
        vault_bump,
    )?;

    task.status = TaskStatus::Refunded;

    Ok(())
}
