import { runJudge } from "@basira/shared";
import { getLogger } from "../log.js";
import { trackInflight } from "../lifecycle.js";

export function triggerJudge(taskId: string): void {
  const log = getLogger();
  const promise = (async () => {
    try {
      const verdict = await runJudge(taskId);
      log.info({ taskId, verdict: verdict.verdict, model: verdict.model }, "judge ran");
    } catch (err) {
      log.error({ err, taskId }, "judge failed");
    }
  })();
  trackInflight(promise);
}
