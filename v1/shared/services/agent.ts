import { query } from '../db/pool';
import { Agent } from '../domain';

export async function getAgent(wallet: string): Promise<Agent | null> {
  const res = await query('SELECT * FROM agents WHERE wallet = $1', [wallet]);
  return res.rows[0] || null;
}

export async function preRegisterAgent(_wallet: string, _metadata: unknown) {
  // Stage 1: stubbed for v1 scaffold.
  return { session_token: 'mock_session', verification_nonce: 'mock_nonce', health_nonce: 'mock_health' };
}

export async function verifyAndRegisterAgent(_sessionToken: string, _signature: string, _publicKey: string) {
  // Stages 2 to 4: stubbed for v1 scaffold.
  // Real flow will: verify signature, ping endpoint, insert agent row.
  return { api_key: 'mock_api_key', webhook_secret: 'mock_secret' };
}
