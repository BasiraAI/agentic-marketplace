use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer as token_transfer, Mint, Token, TokenAccount, Transfer};

use crate::constants::{
    FEE_BPS, MIN_DEADLINE_BUFFER_SECONDS, MIN_REWARD_USDC_BASE_UNITS, TASK_SEED, VAULT_SEED,
};
use crate::errors::BasiraError;
use crate::state::{Currency, EscrowVault, TaskAccount, TaskMode, TaskStatus};

#[derive(Accounts)]
#[instruction(task_id: [u8; 16])]
pub struct CreateTaskUsdc<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        init,
        payer = poster,
        space = 8 + TaskAccount::INIT_SPACE,
        seeds = [TASK_SEED, &task_id],
        bump,
    )]
    pub task_account: Account<'info, TaskAccount>,

    #[account(
        init,
        payer = poster,
        space = 8 + EscrowVault::INIT_SPACE,
        seeds = [VAULT_SEED, &task_id],
        bump,
    )]
    pub vault: Account<'info, EscrowVault>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = poster,
    )]
    pub poster_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = poster,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn create_task_usdc_handler(
    ctx: Context<CreateTaskUsdc>,
    task_id: [u8; 16],
    mode: TaskMode,
    amount: u64,
    deadline: i64,
    assigned_agent: Option<Pubkey>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        deadline >= now.saturating_add(MIN_DEADLINE_BUFFER_SECONDS),
        BasiraError::DeadlineTooSoon
    );
    require!(
        amount >= MIN_REWARD_USDC_BASE_UNITS,
        BasiraError::AmountBelowMinimum
    );

    let initial_status = match mode {
        TaskMode::Direct => {
            require!(
                assigned_agent.is_some(),
                BasiraError::DirectRequiresAssignedAgent
            );
            TaskStatus::Assigned
        }
        TaskMode::Bounty => {
            require!(
                assigned_agent.is_none(),
                BasiraError::BountyMustNotPreassign
            );
            TaskStatus::Created
        }
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.poster_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.poster.to_account_info(),
        },
    );
    token_transfer(cpi_ctx, amount)?;

    let task = &mut ctx.accounts.task_account;
    task.task_id = task_id;
    task.poster_wallet = ctx.accounts.poster.key();
    task.assigned_agent = assigned_agent;
    task.mode = mode;
    task.status = initial_status;
    task.currency = Currency::Usdc;
    task.amount = amount;
    task.fee_bps = FEE_BPS;
    task.deadline = deadline;
    task.submitted_at = None;
    task.created_at = now;
    task.bump = ctx.bumps.task_account;

    let vault = &mut ctx.accounts.vault;
    vault.task_id = task_id;
    vault.bump = ctx.bumps.vault;

    Ok(())
}
