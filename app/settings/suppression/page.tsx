import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const addressSchema = z.string().trim().toLowerCase().email();

async function addSuppression(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/suppression");

  const parsed = addressSchema.safeParse(String(formData.get("address") ?? ""));
  if (!parsed.success) redirect("/settings/suppression?error=bad-address");

  // RLS allows exactly this: own rows, reason 'manual'. Duplicates surface
  // as a unique violation, which for a do-not-send list is already the
  // desired state.
  const { error } = await supabase.from("suppression_list").insert({
    owner_id: user.id,
    address: parsed.data,
    reason: "manual",
    source: "user",
  });
  if (error && error.code !== "23505") {
    redirect("/settings/suppression?error=add-failed");
  }
  revalidatePath("/settings/suppression");
}

async function removeSuppression(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/suppression");

  // RLS restricts deletion to the user's own manual rows: provider-derived
  // bounce/complaint/unsubscribe entries cannot be removed here, which is
  // the point — those exist to protect recipients and sender reputation.
  await supabase
    .from("suppression_list")
    .delete()
    .eq("id", String(formData.get("id") ?? ""));

  revalidatePath("/settings/suppression");
}

const REASON_HELP: Record<string, string> = {
  manual: "Added by you",
  unsubscribe: "Recipient unsubscribed",
  bounce: "Address bounced",
  complaint: "Marked as spam by the recipient",
};

const ERROR_MESSAGES: Record<string, string> = {
  "bad-address": "Enter a valid email address.",
  "add-failed": "The address could not be added. Try again.",
};

export default async function SuppressionPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: entries } = await supabase
    .from("suppression_list")
    .select("id, address, reason, source, created_at")
    .order("created_at", { ascending: false });

  const rows = entries ?? [];
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Do not send</h1>
      <p className="mt-1 text-sm text-muted">
        Mail composed to these addresses is withheld and recorded as suppressed. Entries from
        bounces, complaints and unsubscribes are added automatically and cannot be removed here.
      </p>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          {errorMessage}
        </p>
      )}

      <form action={addSuppression} className="mt-6 flex gap-2">
        <input
          name="address"
          required
          placeholder="never@example.com"
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing suppressed.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium">{entry.address}</div>
                <div className="text-xs text-muted">
                  {REASON_HELP[entry.reason] ?? entry.reason} ·{" "}
                  {new Date(entry.created_at).toLocaleDateString()}
                </div>
              </div>
              {entry.reason === "manual" && (
                <form action={removeSuppression}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
