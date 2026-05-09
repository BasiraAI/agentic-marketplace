import cron from 'node-cron';
import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import { ChainListener } from './chain-listener';
import { runAutoRelease } from './cron/auto-release';
import { runAutoDispute } from './cron/auto-dispute';
import { runExpireTasks } from './cron/expire-tasks';
import { runGhostDisputes } from './cron/ghost-disputes';
import { runRetryWebhooks } from './cron/retry-webhooks';
import { runHealthChecks } from './cron/health-check';

dotenv.config();

async function bootstrap() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('Bootstrapping Basira Worker...');

  // Start Chain Listener
  const listener = new ChainListener(rpcUrl);
  await listener.start();

  // Schedule Crons
  cron.schedule('*/5 * * * *', () => runAutoRelease(connection));
  cron.schedule('*/5 * * * *', () => runAutoDispute(connection));
  cron.schedule('*/5 * * * *', () => runExpireTasks(connection));
  cron.schedule('*/5 * * * *', () => runGhostDisputes(connection));
  cron.schedule('* * * * *', () => runRetryWebhooks());
  cron.schedule('0 * * * *', () => runHealthChecks());

  console.log('Worker running. Press Ctrl+C to exit.');

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await listener.stop();
    process.exit(0);
  });
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
