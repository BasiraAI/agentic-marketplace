use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account as token_close_account, transfer as token_transfer, CloseAccount, Transfer,
};

use crate::constants::VAULT_SEED;
use crate::errors::BasiraError;

/// Compute the (agent, treasury) split for a settlement.
/// Treasury gets `amount * fee_bps / 10_000`, agent gets the remainder.
pub fn split_amount(amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(BasiraError::NumericOverflow)?
        .checked_div(10_000)
        .ok_or(BasiraError::NumericOverflow)? as u64;
    let agent_amount = amount.checked_sub(fee).ok_or(BasiraError::NumericOverflow)?;
    Ok((agent_amount, fee))
}

/// Move lamports from a program-owned account to any writable account by
/// directly manipulating the lamports fields. Safe because both accounts are
/// owned by trusted programs and the runtime enforces sum-conservation.
pub fn pay_from_program_owned<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;

    **from_lamports = from_lamports
        .checked_sub(amount)
        .ok_or(BasiraError::NumericOverflow)?;
    **to_lamports = to_lamports
        .checked_add(amount)
        .ok_or(BasiraError::NumericOverflow)?;
    Ok(())
}

/// PDA-signed SPL token transfer from the vault token account to a recipient.
/// `vault` is the EscrowVault PDA acting as authority over `vault_token_account`.
/// `task_id` and `vault_bump` are needed for the signer-seeds derivation.
pub fn vault_token_transfer<'info>(
    token_program: &AccountInfo<'info>,
    vault_token_account: &AccountInfo<'info>,
    recipient_token_account: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    task_id: &[u8; 16],
    vault_bump: u8,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[VAULT_SEED, task_id, &[vault_bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.clone(),
        Transfer {
            from: vault_token_account.clone(),
            to: recipient_token_account.clone(),
            authority: vault.clone(),
        },
        signer_seeds,
    );
    token_transfer(cpi_ctx, amount)
}

/// PDA-signed close of a token account. Used to recover the rent on the vault
/// token account back to the poster after settlement / refund.
pub fn vault_token_close<'info>(
    token_program: &AccountInfo<'info>,
    vault_token_account: &AccountInfo<'info>,
    rent_destination: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    task_id: &[u8; 16],
    vault_bump: u8,
) -> Result<()> {
    let seeds: &[&[u8]] = &[VAULT_SEED, task_id, &[vault_bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.clone(),
        CloseAccount {
            account: vault_token_account.clone(),
            destination: rent_destination.clone(),
            authority: vault.clone(),
        },
        signer_seeds,
    );
    token_close_account(cpi_ctx)
}
