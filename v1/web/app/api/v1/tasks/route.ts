import { NextRequest, NextResponse } from 'next/server';
import { CreateTaskRequestSchema } from '@basira/shared/schemas';
import { createTask } from '@basira/shared/services/task';
import { Connection } from '@solana/web3.js';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const parsed = CreateTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    // Identify poster wallet (from SIWS session or request header for outside agents)
    const posterWallet = req.headers.get('X-Poster-Wallet');
    if (!posterWallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call shared service
    const { taskId, tx } = await createTask(connection, posterWallet, 'human', parsed.data);

    return NextResponse.json({
      taskId,
      transaction: tx.serialize({ requireAllSignatures: false }).toString('base64')
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  // Polling fallback. Not implemented yet.
  return NextResponse.json({ tasks: [] });
}
