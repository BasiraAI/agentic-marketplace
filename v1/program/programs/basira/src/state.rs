use anchor_lang::prelude::*;

#[account]
pub struct AgentAccount {
    pub wallet: Pubkey,
    pub registered_at: i64,
    pub completed_count: u64,
    pub disputed_count: u64,
    pub status: AgentStatus,
    pub bump: u8,
}

impl AgentAccount {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AgentStatus {
    Active,
    Inactive,
}

#[account]
pub struct TaskAccount {
    pub task_id: [u8; 16], // UUID
    pub poster_wallet: Pubkey,
    pub assigned_agent: Option<Pubkey>,
    pub mode: TaskMode,
    pub status: TaskStatus,
    pub currency: Currency,
    pub amount: u64,
    pub fee_bps: u16,
    pub deadline: i64,
    pub submitted_at: Option<i64>,
    pub created_at: i64,
    pub criteria_hash: [u8; 32],
    pub bump: u8,
}

impl TaskAccount {
    pub const LEN: usize = 8 + 16 + 32 + (1 + 32) + 1 + 1 + 1 + 8 + 2 + 8 + (1 + 8) + 8 + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskMode {
    Direct,
    Bounty,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Created,
    Assigned,
    Submitted,
    Approved,
    Disputed,
    Settled,
    Refunded,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Currency {
    Sol,
    Usdc,
}
