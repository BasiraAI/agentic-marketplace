use anchor_lang::prelude::*;

#[error_code]
pub enum BasiraError {
    #[msg("Task deadline must be in the future")]
    InvalidDeadline,
    #[msg("Task mode is invalid for this operation")]
    InvalidMode,
    #[msg("Task status is invalid for this operation")]
    InvalidStatus,
    #[msg("Only the assigned agent can perform this operation")]
    NotAssignedAgent,
    #[msg("Agent has not accepted the direct assignment within the window")]
    OfferExpired,
    #[msg("Task deadline has passed")]
    DeadlinePassed,
    #[msg("Task deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Auto-release window has not elapsed yet")]
    AutoReleaseWindowNotElapsed,
    #[msg("Unauthorized signer for this operation")]
    Unauthorized,
    #[msg("Reward must be greater than 0")]
    RewardTooSmall,
    #[msg("Cannot cancel an assigned task")]
    CannotCancelAssigned,
}
