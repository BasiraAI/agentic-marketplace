use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AgentStatus {
    Active,
    Inactive,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum TaskMode {
    Direct,
    Bounty,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Currency {
    Sol,
    Usdc,
}

#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub wallet: Pubkey,
    pub registered_at: i64,
    pub completed_count: u64,
    pub disputed_count: u64,
    pub status: AgentStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TaskAccount {
    pub task_id: [u8; 16],
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
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowVault {
    pub task_id: [u8; 16],
    pub bump: u8,
}
