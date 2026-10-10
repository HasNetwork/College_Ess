import { CORE_VERSION } from "@clg-ess/core";

export interface Env {
  ENVIRONMENT?: string;
  APP_URL?: string;
  TICK_SECRET?: string;
}

export default {
  /**
   * Cloudflare Worker Dumb Trigger
   * PLAN 0-8 §1:
   * The Worker is a dumb trigger firing every minute via cron.
   * All domain and scheduling logic remains in the Next.js application (/api/internal/tick).
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const appUrl = env.APP_URL;
    const tickSecret = env.TICK_SECRET;

    // Fail closed (RULES R18): an empty secret or a localhost target is a silent
    // misconfiguration. Throwing marks the cron invocation failed in Workers logs.
    if (!appUrl || !tickSecret) {
      const missing = [!appUrl && "APP_URL", !tickSecret && "TICK_SECRET"].filter(Boolean);
      throw new Error(`[Scheduler] Refusing to tick: missing ${missing.join(", ")}`);
    }

    console.log(
      `[Scheduler v${CORE_VERSION}] Triggering tick for ${new Date(controller.scheduledTime).toISOString()}`,
    );

    try {
      const response = await fetch(`${appUrl}/api/internal/tick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tick-secret": tickSecret,
          Authorization: `Bearer ${tickSecret}`,
        },
        body: JSON.stringify({
          scheduledTime: controller.scheduledTime,
          cron: controller.cron,
        }),
      });

      if (!response.ok) {
        console.error(
          `[Scheduler] Tick failed with HTTP status ${response.status}: ${await response.text()}`,
        );
      } else {
        const result = await response.json();
        console.log("[Scheduler] Tick completed successfully:", result);
      }
    } catch (err) {
      console.error("[Scheduler] Network error contacting tick endpoint:", err);
    }
  },

  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response(`College Ess Scheduler v${CORE_VERSION} is active`);
  },
};
