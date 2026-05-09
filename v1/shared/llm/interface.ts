import { Task, Verdict } from "../domain";

export interface LLMProvider {
  evaluate(task: Task, deliverableContent: string): Promise<Verdict>;
}
