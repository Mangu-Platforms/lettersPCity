/**
 * Environment contract — validated once, at module load, so a misconfigured
 * deployment fails on boot instead of at the first request that needs a value.
 *
 * Mirrors the pattern in my_publishing/lib/utils/env-validation.ts.
 */

import { z } from "zod";

/** Values safe to ship to the browser. */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be a full https:// URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** Server-only values. Never imported from a client component. */
const serverSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    INBOUND_MAIL_WEBHOOK_SECRET: z
      .string()
      .min(32, "must be at least 32 characters; generate with `openssl rand -hex 32`"),
    // Outbound hand-off. 'noop' keeps every environment working with no
    // provider account: sends are recorded as skipped, nothing leaves.
    MAIL_PROVIDER: z.enum(["noop", "resend"]).default("noop"),
    RESEND_API_KEY: z.string().min(1).optional(),
    // Svix signing secret for Resend's inbound webhook (whsec_…). Optional:
    // without it the adapter route answers 503 instead of running open.
    RESEND_INBOUND_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    // Authorizes GET /api/domains/verify (Vercel cron sends it as a Bearer
    // token). Optional so environments without the cron still boot.
    CRON_SECRET: z.string().min(16).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "required when MAIL_PROVIDER=resend",
      });
    }
  });

function parse<T extends z.ZodTypeAny>(schema: T, source: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment:\n${detail}\n\nSee .env.example.`);
  }
  return result.data;
}

/**
 * Validated lazily rather than at module load. Eager validation looks appealing
 * -- fail on boot, not on first request -- but `next build` imports every route
 * module to collect page data, so an eager throw makes the build itself require
 * production secrets. Lazy keeps the fail-fast behaviour at runtime while
 * letting CI build without them.
 *
 * Next inlines `process.env.NEXT_PUBLIC_*` wherever the member access appears
 * literally, including inside a function body, so these stay statically
 * analyzable and must not be spread from `process.env`.
 */
let cachedClientEnv: z.infer<typeof clientSchema> | null = null;
export function clientEnv(): z.infer<typeof clientSchema> {
  if (!cachedClientEnv) {
    cachedClientEnv = parse(
      clientSchema,
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      "client"
    );
  }
  return cachedClientEnv;
}

/**
 * Lazy, so importing this module from a client bundle cannot throw on missing
 * server secrets. Call only from server code.
 */
let cachedServerEnv: z.infer<typeof serverSchema> | null = null;
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() called in the browser — server secrets are not available there.");
  }
  if (!cachedServerEnv) {
    cachedServerEnv = parse(
      serverSchema,
      {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        INBOUND_MAIL_WEBHOOK_SECRET: process.env.INBOUND_MAIL_WEBHOOK_SECRET,
        MAIL_PROVIDER: process.env.MAIL_PROVIDER,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        RESEND_INBOUND_WEBHOOK_SECRET: process.env.RESEND_INBOUND_WEBHOOK_SECRET,
        CRON_SECRET: process.env.CRON_SECRET,
      },
      "server"
    );
  }
  return cachedServerEnv;
}
