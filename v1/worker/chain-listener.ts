import { Connection, PublicKey } from '@solana/web3.js';
// import { PROGRAM_ID } from '@basira/shared/solana/transactions';
import { query } from '@basira/shared/db/pool';

const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

export class ChainListener {
  private connection: Connection;
  private subscriptionId: number | null = null;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async start() {
    console.log(`Starting chain listener for program: ${PROGRAM_ID.toBase58()}`);
    
    // Resume from last seen slot (pseudo-code representation)
    const lastSeenRes = await query('SELECT MAX(last_seen_slot) as slot FROM sync_state');
    const lastSlot = lastSeenRes.rows[0]?.slot || 0;
    console.log(`Resuming from slot: ${lastSlot}`);

    this.subscriptionId = this.connection.onLogs(
      PROGRAM_ID,
      async (logs, ctx) => {
        if (logs.err) return;
        
        try {
          await this.processLogs(logs.logs, logs.signature, ctx.slot);
          await query('UPDATE sync_state SET last_seen_slot = $1', [ctx.slot]);
        } catch (err) {
          console.error(`Error processing transaction ${logs.signature}:`, err);
        }
      },
      'confirmed'
    );
  }

  private async processLogs(_logs: string[], _signature: string, _slot: number) {
    // Stub. Real implementation will:
    //   1. Parse instructions out of the logs.
    //   2. Call shared/services/* to reflect state in the DB.
    //   3. Example: on "Instruction: SubmitDeliverable" update task status.
  }

  async stop() {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
    }
  }
}
