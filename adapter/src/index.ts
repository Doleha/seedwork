import type {
  ServerAdapterModule,
  AdapterExecutionContext,
  AdapterExecutionResult,
} from './types/paperclip.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { Semaphore } from './semaphore.js';
import { TOOL_DEFINITIONS, executeToolCall } from './tools.js';
import { scoreOutput } from './quality.js';
import { paperclipClient } from './paperclip-client.js';

const semaphore = new Semaphore(2);
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Tracks consecutive empty runs per agent for backoff calculation.
async function getConsecutiveEmptyRuns(agentId: string): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM agent_performance
     WHERE agent_id = $1
       AND created_at > NOW() - INTERVAL '7 days'
       AND flags @> ARRAY['preflight_skipped']::text[]`,
    [agentId]
  );
  return parseInt((result.rows[0] as Record<string, string>)?.count ?? '0');
}

// Runs a cheap COUNT query before touching the LLM.
// Returns true if work exists, false if run should be skipped.
async function runPreflightCheck(
  sql: string | null,
  skipIfZero: boolean
): Promise<{ shouldRun: boolean }> {
  if (!sql || !skipIfZero) return { shouldRun: true };
  try {
    const result = await db.query(sql);
    const row = result.rows[0] as Record<string, string> | undefined;
    const count = parseInt(row?.count ?? row?.['count(*)'] ?? '1');
    return { shouldRun: count > 0 };
  } catch {
    return { shouldRun: true };
  }
}

// Trims oldest messages when approaching the context limit.
const MAX_MESSAGES_BEFORE_TRIM = 16;
const MESSAGES_TO_KEEP_AFTER_TRIM = 8;

function trimContextIfNeeded(
  messages: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  if (messages.length <= MAX_MESSAGES_BEFORE_TRIM) return messages;
  const first = messages[0];
  const recent = messages.slice(-MESSAGES_TO_KEEP_AFTER_TRIM);
  return [
    first,
    { role: 'user', content: '[Earlier conversation trimmed to fit context window]' },
    ...recent,
  ];
}

// Retry with exponential backoff for transient llama-server errors.
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status < 500) throw new Error(`HTTP ${response.status}`);
      lastError = new Error(`llama-server error: ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxAttempts) {
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export const localLlmAdapter: ServerAdapterModule = {
  type: 'local_llm',

  async execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
    const { runId, agent, context } = ctx;

    // Preflight check — skip LLM entirely if no work to do
    const preflightSql = ctx.config.preflightCheck as { sql?: string; skipIfZero?: boolean } | null;
    if (preflightSql?.sql) {
      const { shouldRun } = await runPreflightCheck(preflightSql.sql, preflightSql.skipIfZero ?? true);
      if (!shouldRun) {
        await db.query(
          `INSERT INTO agent_performance
           (agent_id, run_id, auto_score, fields_complete, reasoning_present,
            entities_count, flags, input_tokens, output_tokens)
           VALUES ($1, $2, 100, true, true, 0, ARRAY['preflight_skipped'], 0, 0)`,
          [agent.id, runId]
        ).catch(() => {});

        const dynamicCfg = ctx.config.dynamicSchedule as {
          baseIntervalSec: number; maxIntervalSec: number;
          backoffMultiplier: number; backoffAfterEmptyRuns: number;
        } | null;
        if (dynamicCfg) {
          const emptyRuns = await getConsecutiveEmptyRuns(agent.id);
          if (emptyRuns >= dynamicCfg.backoffAfterEmptyRuns) {
            const newInterval = Math.min(
              dynamicCfg.baseIntervalSec * Math.pow(
                dynamicCfg.backoffMultiplier,
                Math.floor(emptyRuns / dynamicCfg.backoffAfterEmptyRuns)
              ),
              dynamicCfg.maxIntervalSec
            );
            // TODO: Update agent interval via Paperclip API when endpoint is confirmed
            await db.query(
              `INSERT INTO events_log (type, entity_type, entity_id, payload, created_by)
               VALUES ('schedule_backoff', 'agent', $1, $2, 'local_llm_adapter')`,
              [agent.id, JSON.stringify({ newIntervalSec: newInterval, emptyRuns })]
            ).catch(() => {});
          }
        }

        return {
          exitCode: 0, signal: null, timedOut: false,
          summary: 'No pending work. Skipping run to conserve resources.',
          usage: { inputTokens: 0, outputTokens: 0 },
          costUsd: 0,
          model: 'qwen3.6:35b-a3b',
          provider: 'local_llm',
        };
      }
    }

    // Load instructions file
    const instructionsPath = (ctx.config.instructionsFilePath as string) ?? '';
    let systemPrompt = '';
    try {
      systemPrompt = readFileSync(join('/app/instructions', instructionsPath), 'utf-8');
    } catch {
      return {
        exitCode: 1, signal: null, timedOut: false,
        errorMessage: `Instructions file not found: ${instructionsPath}`,
      };
    }

    // Prepend org-profile.md — gives every agent org identity, contacts, and cultural tone
    try {
      const orgProfile = readFileSync(join('/app/instructions', 'shared/org-profile.md'), 'utf-8');
      systemPrompt = orgProfile + '\n\n---\n\n' + systemPrompt;
    } catch {
      // org-profile.md not yet generated — continue without it
    }

    const userMessage = `Company ID: ${agent.companyId}
Agent ID: ${agent.id}
Agent Name: ${agent.name}
Wake Reason: ${context.wakeReason ?? 'heartbeat'}
Task ID: ${context.taskId ?? 'none'}
Run ID: ${runId}

Review your responsibilities and execute your role. Use the available tools
to query data, write decisions, create tasks, or request hires as needed.`;

    await semaphore.acquire();

    let output = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:9874';

      let messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: userMessage }
      ];

      let iterationsLeft = 10;
      while (iterationsLeft-- > 0) {
        const trimmedMessages = trimContextIfNeeded(messages);

        const response = await fetchWithRetry(
          `${baseUrl}/v1/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen3.6:35b-a3b',
              messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
              tools: TOOL_DEFINITIONS,
              tool_choice: 'auto',
              temperature: 0.7,
              max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(870000),
          }
        );

        const result = await response.json() as {
          choices: Array<{
            message: {
              role: string;
              content?: string;
              tool_calls?: Array<{
                id: string;
                function: { name: string; arguments: string };
              }>;
            };
            finish_reason: string;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        inputTokens += result.usage?.prompt_tokens ?? 0;
        outputTokens += result.usage?.completion_tokens ?? 0;

        const choice = result.choices[0];
        messages.push({ role: 'assistant', content: choice.message.content ?? '' });
        output += choice.message.content ?? '';

        if (!choice.message.tool_calls?.length || choice.finish_reason === 'stop') {
          break;
        }

        for (const toolCall of choice.message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const toolResult = await executeToolCall(
            toolCall.function.name, args, db, paperclipClient, agent.companyId, agent.id
          );
          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
          });
        }
      }

    } finally {
      semaphore.release();
    }

    const quality = scoreOutput(output, agent.name);

    // Cost tracking: estimated cloud equivalent for capacity planning.
    // Local inference is near-zero actual cost — tracked as cloud equivalent only.
    const estimatedCloudEquivalentUsd =
      (inputTokens * 0.000003) + (outputTokens * 0.000015);

    try {
      await db.query(
        `INSERT INTO agent_performance
         (agent_id, run_id, auto_score, fields_complete, reasoning_present,
          entities_count, flags, input_tokens, output_tokens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [agent.id, runId, quality.score, quality.fieldsComplete,
         quality.reasoningPresent, quality.entitiesCount,
         quality.flags, inputTokens, outputTokens]
      );
    } catch {
      // Don't fail the run if performance logging fails
    }

    // Reset dynamic backoff on productive run
    await db.query(
      `INSERT INTO events_log (type, entity_type, entity_id, payload, created_by)
       VALUES ('schedule_reset', 'agent', $1, $2, 'local_llm_adapter')`,
      [agent.id, JSON.stringify({ runId, resetAt: new Date().toISOString() })]
    ).catch(() => {});

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: output.substring(0, 500),
      usage: { inputTokens, outputTokens },
      costUsd: estimatedCloudEquivalentUsd,
      model: 'qwen3.6:35b-a3b',
      provider: 'local_llm',
    };
  },

  async testEnvironment(ctx) {
    const checks = [];

    const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:9874';
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      checks.push({
        code: 'llm_reachable',
        level: 'info' as const,
        message: `llama-server reachable at ${baseUrl} (${res.status})`,
      });
    } catch {
      checks.push({
        code: 'llm_unreachable',
        level: 'error' as const,
        message: `Cannot reach llama-server at ${baseUrl}. Board notification required.`,
      });
      // TODO: fire Paperclip system_alert approval request when endpoint is confirmed
    }

    if (!ctx.config.instructionsFilePath) {
      checks.push({
        code: 'instructions_missing',
        level: 'error' as const,
        message: 'instructionsFilePath not configured',
      });
    }

    return {
      adapterType: 'local_llm',
      status: checks.some(c => c.level === 'error') ? 'fail' : 'pass',
      checks,
      testedAt: new Date().toISOString(),
    };
  },

  models: [{ id: 'qwen3.6:35b-a3b', label: 'Qwen 3.6 35B A3B (local)' }],
  agentConfigurationDoc: `# local_llm adapter\n\nRuns agents via local llama-server.\n\nRequired: instructionsFilePath (path relative to /app/instructions/)\nOptional:\n  preflightCheck: { sql: string, skipIfZero: boolean } — skip LLM if no work\n  dynamicSchedule: { baseIntervalSec, maxIntervalSec, backoffMultiplier, backoffAfterEmptyRuns }`,
};
