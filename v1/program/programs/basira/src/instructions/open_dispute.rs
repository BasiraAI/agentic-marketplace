use anchor_lang::prelude::*;

use crate::constants::{ARBITRATOR_KEY, TASK_SEED};
use crate::errors::BasiraError;
use crate::state::{TaskAccount, TaskStatus};

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [TASK_SEED, &task_account.task_id],
        bump = task_account.bump,
    )]
    pub task_account: Account<'info, TaskAccount>,
}

pub fn open_dispute_handler(ctx: Context<OpenDispute>) -> Result<()> {
    let task = &mut ctx.accounts.task_account;
    let signer = ctx.accounts.signer.key();

    require!(
        signer == task.poster_wallet || signer == ARBITRATOR_KEY,
        BasiraError::NotDisputeAuthority
    );
    require!(
        matches!(task.status, TaskStatus::Submitted),
        BasiraError::InvalidTaskStatus
    );

    task.status = TaskStatus::Disputed;

    Ok(())
}
