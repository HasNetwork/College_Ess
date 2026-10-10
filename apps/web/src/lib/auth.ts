import { QuietHoursEnabledSchema, TimeZoneSchema, UserRoleSchema } from "@clg-ess/core";
import { createDbClient, requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";

const db = createDbClient();

export const auth = betterAuth({
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: requireEnv("BETTER_AUTH_URL"),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
  user: {
    // Declared so the session carries them. `input: false` makes both server-owned: sign-up
    // and update-user refuse them, because they decide what you may read and which college
    // you belong to.
    additionalFields: {
      role: {
        type: [...UserRoleSchema.options],
        // The column is NOT NULL; the default fills it on create, before this is checked.
        required: true,
        defaultValue: "student",
        input: false,
      },
      collegeId: {
        type: "string",
        required: false,
        input: false,
      },
      // The student's own settings (0.5-4): sign-up sends the device's zone, and update-user
      // changes either. Better Auth checks no types itself, so each has a validator.
      timezone: {
        type: "string",
        required: false,
        defaultValue: "UTC",
        validator: { input: TimeZoneSchema },
      },
      quietHoursEnabled: {
        type: "boolean",
        required: false,
        defaultValue: true,
        validator: { input: QuietHoursEnabledSchema },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    twoFactor({
      issuer: "College Ess",
    }),
  ],
});

export type Auth = typeof auth;
