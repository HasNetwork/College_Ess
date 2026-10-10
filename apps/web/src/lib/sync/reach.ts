/**
 * Whether a response came from College Ess itself. Every sync answer is JSON, including its
 * errors. Anything else is something in between: a campus Wi-Fi login page (often a 200),
 * or the host's own error page. Those mean the app was not reached, however online the
 * device says it is (0.5-4 §5).
 */
export async function readAppAnswer(response: Response): Promise<unknown | undefined> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** The app could not be reached: no response at all, or not one from College Ess. */
export class AppUnreachableError extends Error {
  override name = "AppUnreachableError";
}
