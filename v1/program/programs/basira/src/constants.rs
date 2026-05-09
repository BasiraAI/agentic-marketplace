use anchor_lang::prelude::*;

#[constant]
pub const FEE_BPS: u16 = 500; // 5%

#[constant]
pub const AUTO_RELEASE_SECONDS: i64 = 86_400; // 24 hours

#[constant]
pub const OFFER_RESPONSE_SECONDS: i64 = 60; // 60 seconds

// Deploy-time constants. For v1 these are hardcoded per spec.
// Dev keypairs live in keys/*.json (gitignored). Regenerate with: node scripts/keygen.mjs
pub mod pubkeys {
    use anchor_lang::prelude::{pubkey, Pubkey};

    pub const TREASURY: Pubkey = pubkey!("AYdAWWbvHKZeWgcSAzCqwMtCwGPhzw6uqieiYq7565Z5");
    pub const ARBITRATOR_KEY: Pubkey = pubkey!("2KswvJ63ykEAqKQSUV4gLftaxcdEYPSLRnoJ1EgQ2Q4Z");
    pub const KEEPER_PUBKEY: Pubkey = pubkey!("FGrPtosT4VUcu4WrTkHuekxbTSHJcKtsij1V8tcNNCZ7");
}
