use anchor_lang::prelude::*;

use crate::constants::AGENT_SEED;
use crate::state::{AgentAccount, AgentStatus};

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,

    #[account(
        init,
        payer = wallet,
        space = 8 + AgentAccount::INIT_SPACE,
        seeds = [AGENT_SEED, wallet.key().as_ref()],
        bump,
    )]
    pub agent_account: Account<'info, AgentAccount>,

    pub system_program: Program<'info, System>,
}

pub fn register_agent_handler(ctx: Context<RegisterAgent>) -> Result<()> {
    let agent = &mut ctx.accounts.agent_account;
    let clock = Clock::get()?;

    agent.wallet = ctx.accounts.wallet.key();
    agent.registered_at = clock.unix_timestamp;
    agent.completed_count = 0;
    agent.disputed_count = 0;
    agent.status = AgentStatus::Active;
    agent.bump = ctx.bumps.agent_account;

    Ok(())
}
