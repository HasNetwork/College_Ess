import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { type TestUser, api, createUser, seedTwoColleges, testDb } from "./harness";

// `role` and `college_id` decide what you may read and which tenant you belong to, so a
// client must never set either. Every request below goes through Better Auth's real
// handler (/api/auth/[...all]), the way a browser reaches it.

const fromTheApp = () => ({ headers: { origin: requireEnv("BETTER_AUTH_URL") } });

async function storedUser(email: string) {
  const [row] = await testDb().select().from(schema.user).where(eq(schema.user.email, email));
  return row;
}

describe("server-owned user fields", () => {
  let studentA: TestUser;
  let collegeA: schema.College;
  let collegeB: schema.College;

  beforeAll(async () => {
    ({ studentA, collegeA, collegeB } = await seedTwoColleges());
  });

  it("puts your role and college on the session", async () => {
    // Before 0.5-2 nothing declared these fields, so routes cast session.user to read them
    // and always got undefined: every viewer was a collegeless student.
    const coAdmin = await createUser(collegeA.id, "Co-admin", "co_admin");

    const res = await api.get("/api/auth/get-session", { as: coAdmin });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("co_admin");
    expect(res.body.user.collegeId).toBe(collegeA.id);
  });

  it("will not let sign-up choose a role or a college", async () => {
    const asAdmin = `${uuidv7()}@users.test`;
    const intoB = `${uuidv7()}@users.test`;
    const password = `pw-${uuidv7()}`;

    await api.post(
      "/api/auth/sign-up/email",
      { email: asAdmin, password, name: "Mallory", role: "platform_admin" },
      fromTheApp(),
    );
    await api.post(
      "/api/auth/sign-up/email",
      { email: intoB, password, name: "Mallory", collegeId: collegeB.id },
      fromTheApp(),
    );

    // Refused, or accepted without the field: either way nobody self-appoints.
    const admin = await storedUser(asAdmin);
    expect(admin?.role ?? "student").toBe("student");
    expect((await storedUser(intoB))?.collegeId ?? null).toBeNull();
  });

  it("stores the time zone sign-up sends (0.5-4)", async () => {
    // The sign-up page sends the device's zone, so each student's reminders run on their
    // own clock from the first day.
    const email = `${uuidv7()}@users.test`;
    const res = await api.post(
      "/api/auth/sign-up/email",
      { email, password: `pw-${uuidv7()}`, name: "Asha", timezone: "Asia/Kolkata" },
      fromTheApp(),
    );

    expect(res.status).toBe(200);
    expect((await storedUser(email))?.timezone).toBe("Asia/Kolkata");
  });

  it("refuses a time zone or a quiet-hours value the scheduler could not use", async () => {
    // An unknown zone reaching the database would make every tick's time formatting throw.
    const email = `${uuidv7()}@users.test`;
    const signUp = await api.post(
      "/api/auth/sign-up/email",
      { email, password: `pw-${uuidv7()}`, name: "Asha", timezone: "Mars/Olympus_Mons" },
      fromTheApp(),
    );
    const update = await api.post(
      "/api/auth/update-user",
      { timezone: "Not/AZone" },
      { as: studentA, ...fromTheApp() },
    );
    // Postgres would read the string "no" as false; the switch takes a boolean only.
    const quiet = await api.post(
      "/api/auth/update-user",
      { quietHoursEnabled: "no" },
      { as: studentA, ...fromTheApp() },
    );

    expect(signUp.status).toBe(400);
    expect(await storedUser(email)).toBeUndefined();
    expect(update.status).toBe(400);
    expect(quiet.status).toBe(400);
    const row = await storedUser(studentA.email);
    expect(row?.timezone).toBe("UTC");
    expect(row?.quietHoursEnabled).toBe(true);
  });

  it("will not let a signed-in user change their own role or college", async () => {
    const promote = await api.post(
      "/api/auth/update-user",
      { role: "platform_admin" },
      { as: studentA, ...fromTheApp() },
    );
    const move = await api.post(
      "/api/auth/update-user",
      { collegeId: collegeB.id },
      { as: studentA, ...fromTheApp() },
    );

    expect(promote.status).toBe(400);
    expect(move.status).toBe(400);
    const row = await storedUser(studentA.email);
    expect(row?.role).toBe("student");
    expect(row?.collegeId).toBe(collegeA.id);
  });
});
