use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("9Re1qpCeqaVAU984Au3YSCnGLQvkYc1UzVHqmeSNVi4A");

#[program]
pub mod task_marketplace {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        verifier_authority: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.task_count = 0;
        registry.verifier_authority = verifier_authority;
        registry.bump = ctx.bumps.registry;
        msg!("Registry initialized, verifier: {}", verifier_authority);
        Ok(())
    }

    /// Poster creates a task and funds the escrow in one instruction.
    /// task_id must equal registry.task_count (read off-chain before calling).
    pub fn post_task(
        ctx: Context<PostTask>,
        task_id: u64,
        reward_lamports: u64,
        timeout_seconds: i64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        require!(
            task_id == registry.task_count,
            ErrorCode::InvalidTaskId
        );

        // Transfer reward to escrow
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.poster.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            reward_lamports,
        )?;

        let clock = Clock::get()?;
        let task = &mut ctx.accounts.task;
        task.poster = ctx.accounts.poster.key();
        task.task_id = task_id;
        task.reward_lamports = reward_lamports;
        task.status = TaskStatus::Open;
        task.submission_count = 0;
        task.solver = Pubkey::default();
        task.created_at = clock.unix_timestamp;
        task.timeout_at = clock.unix_timestamp
            .checked_add(timeout_seconds)
            .ok_or(ErrorCode::InvalidStatus)?;
        task.bump = ctx.bumps.task;
        task.escrow_bump = ctx.bumps.escrow;

        registry.task_count = registry.task_count.checked_add(1).unwrap();

        msg!("Task {} posted, reward {} lamports, timeout at {}", task_id, reward_lamports, task.timeout_at);
        Ok(())
    }

    /// Called by the platform server after a solver submits code off-chain.
    pub fn submit_solution(ctx: Context<AuthorityAction>, solver: Pubkey) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(
            task.status == TaskStatus::Open || task.status == TaskStatus::Failed,
            ErrorCode::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.verifier_authority,
            ErrorCode::NotVerifierAuthority
        );

        task.solver = solver;
        task.status = TaskStatus::Submitted;
        task.submission_count = task.submission_count.saturating_add(1);

        msg!("Solution submitted by {} for task {}, attempt #{}", solver, task.task_id, task.submission_count);
        Ok(())
    }

    /// Called by the platform server when Claude returns a passing verdict.
    pub fn mark_verified(ctx: Context<AuthorityAction>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Submitted, ErrorCode::InvalidStatus);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.verifier_authority,
            ErrorCode::NotVerifierAuthority
        );

        task.status = TaskStatus::Verified;
        msg!("Task {} verified", task.task_id);
        Ok(())
    }

    /// Called by the platform server when Claude returns a failing verdict.
    pub fn mark_failed(ctx: Context<AuthorityAction>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Submitted, ErrorCode::InvalidStatus);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.verifier_authority,
            ErrorCode::NotVerifierAuthority
        );

        task.status = TaskStatus::Failed;
        msg!("Task {} failed verification, solver may resubmit", task.task_id);
        Ok(())
    }

    /// Called by the platform server after mark_verified to send the reward to the solver.
    pub fn release_to_solver(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Verified, ErrorCode::InvalidStatus);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.registry.verifier_authority,
            ErrorCode::NotVerifierAuthority
        );
        require!(
            task.solver == ctx.accounts.solver.key(),
            ErrorCode::WrongSolver
        );

        let reward = task.reward_lamports;
        **ctx.accounts.escrow.try_borrow_mut_lamports()? -= reward;
        **ctx.accounts.solver.try_borrow_mut_lamports()? += reward;

        task.status = TaskStatus::Released;
        msg!("Task {} released {} lamports to {}", task.task_id, reward, task.solver);
        Ok(())
    }

    /// Permissionless: anyone can call this once the timeout has passed.
    pub fn refund_to_poster(ctx: Context<RefundEscrow>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let clock = Clock::get()?;

        require!(
            task.status != TaskStatus::Released && task.status != TaskStatus::Refunded,
            ErrorCode::AlreadySettled
        );
        require!(
            clock.unix_timestamp >= task.timeout_at,
            ErrorCode::TimeoutNotReached
        );
        require!(
            task.poster == ctx.accounts.poster.key(),
            ErrorCode::NotPoster
        );

        let reward = task.reward_lamports;
        **ctx.accounts.escrow.try_borrow_mut_lamports()? -= reward;
        **ctx.accounts.poster.try_borrow_mut_lamports()? += reward;

        task.status = TaskStatus::Refunded;
        msg!("Task {} refunded {} lamports to poster", task.task_id, reward);
        Ok(())
    }
}

// ─── Enums ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    Submitted,
    Verified,
    Failed,
    Released,
    Refunded,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Open
    }
}

// ─── State ────────────────────────────────────────────────────────────────────

#[account]
pub struct Registry {
    pub task_count:         u64,
    pub verifier_authority: Pubkey,
    pub bump:               u8,
}

impl Registry {
    // discriminator(8) + u64(8) + pubkey(32) + u8(1)
    pub const SPACE: usize = 8 + 8 + 32 + 1;
}

#[account]
pub struct Task {
    pub poster:           Pubkey,
    pub task_id:          u64,
    pub reward_lamports:  u64,
    pub status:           TaskStatus,
    pub submission_count: u8,
    pub solver:           Pubkey,
    pub created_at:       i64,
    pub timeout_at:       i64,
    pub bump:             u8,
    pub escrow_bump:      u8,
}

impl Task {
    // discriminator(8) + pubkey(32) + u64(8) + u64(8) + enum(1+1) + u8(1) + pubkey(32) + i64(8) + i64(8) + u8(1) + u8(1)
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 2 + 1 + 32 + 8 + 8 + 1 + 1;
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Registry::SPACE,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct PostTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        init,
        payer = poster,
        space = Task::SPACE,
        seeds = [b"task", task_id.to_le_bytes().as_ref()],
        bump
    )]
    pub task: Account<'info, Task>,

    #[account(
        init,
        payer = poster,
        space = 8,
        seeds = [b"escrow", task_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: SOL-only escrow PDA, holds reward lamports
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorityAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        mut,
        seeds = [b"task", task.task_id.to_le_bytes().as_ref()],
        bump = task.bump,
    )]
    pub task: Account<'info, Task>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        mut,
        seeds = [b"task", task.task_id.to_le_bytes().as_ref()],
        bump = task.bump,
    )]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [b"escrow", task.task_id.to_le_bytes().as_ref()],
        bump = task.escrow_bump,
    )]
    /// CHECK: SOL-only escrow PDA
    pub escrow: UncheckedAccount<'info>,

    /// CHECK: Solver's wallet. Verified against task.solver in the instruction body.
    #[account(mut)]
    pub solver: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    /// CHECK: Poster's wallet. Verified against task.poster in the instruction body.
    #[account(mut)]
    pub poster: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"task", task.task_id.to_le_bytes().as_ref()],
        bump = task.bump,
    )]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [b"escrow", task.task_id.to_le_bytes().as_ref()],
        bump = task.escrow_bump,
    )]
    /// CHECK: SOL-only escrow PDA
    pub escrow: UncheckedAccount<'info>,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid task status for this instruction")]
    InvalidStatus,
    #[msg("Caller is not the registered verifier authority")]
    NotVerifierAuthority,
    #[msg("Timeout has not been reached yet")]
    TimeoutNotReached,
    #[msg("Task has already been settled")]
    AlreadySettled,
    #[msg("Solver account does not match task.solver")]
    WrongSolver,
    #[msg("Caller is not the task poster")]
    NotPoster,
    #[msg("task_id must equal current registry.task_count")]
    InvalidTaskId,
}
