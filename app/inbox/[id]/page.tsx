import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMessage } from "@/lib/messages/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FILE_TARGETS = new Set(["inbox", "archive", "trash"]);

async function fileMessage(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const target = String(formData.get("target") ?? "");
  if (!FILE_TARGETS.has(target)) redirect("/inbox");

  // The user-scoped client: RLS limits this to own rows, and the column
  // grant limits it to (folder, is_read) — exactly what refiling is.
  const supabase = createClient();
  await supabase.from("messages").update({ folder: target }).eq("id", id);

  revalidatePath("/inbox");
  redirect(`/inbox?folder=${target === "inbox" ? "inbox" : target}`);
}

async function deleteForever(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const supabase = createClient();
  // Guarded to trash: deleting is two deliberate steps, never one click
  // from the inbox. Recipients and attachments cascade.
  await supabase.from("messages").delete().eq("id", id).eq("folder", "trash");

  revalidatePath("/inbox");
  redirect("/inbox?folder=trash");
}

export default async function MessagePage({ params }: { params: { id: string } }) {
  const message = await getMessage(params.id);
  // RLS turns "someone else's message" into "no rows", so this covers both
  // a missing id and an unauthorized one.
  if (!message) notFound();

  if (!message.is_read) {
    // Opening a message is what "read" means. Fire-and-forget on the
    // user-scoped client; failure here must not block rendering.
    const supabase = createClient();
    await supabase.from("messages").update({ is_read: true }).eq("id", message.id);
  }

  const recipients: { kind: string; address: string }[] = message.message_recipients ?? [];
  const attempts: { attempt: number; provider: string; status: string; error: string | null; created_at: string }[] =
    message.send_attempts ?? [];
  const lastAttempt = attempts.length
    ? [...attempts].sort((a, b) => b.attempt - a.attempt)[0]
    : null;

  const DELIVERY_LABELS: Record<string, string> = {
    accepted: "Delivered to the mail provider",
    failed: "Delivery failed",
    suppressed: "Withheld — recipients suppressed",
    skipped: "Not delivered — no mail provider configured",
  };

  const inTrash = message.folder === "trash";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={message.folder === "inbox" ? "/inbox" : `/inbox?folder=${message.folder}`}
        className="text-sm text-accent underline"
      >
        ← Back
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {message.subject || "(no subject)"}
      </h1>

      <div className="mt-2 text-sm text-muted">
        <div>From: {message.from_name ? `${message.from_name} <${message.from_address}>` : message.from_address}</div>
        {recipients.length > 0 && (
          <div>To: {recipients.filter((r) => r.kind === "to").map((r) => r.address).join(", ")}</div>
        )}
        <time>{new Date(message.received_at).toLocaleString()}</time>
        {message.direction === "outbound" && lastAttempt && (
          <div className="mt-1">
            {DELIVERY_LABELS[lastAttempt.status] ?? lastAttempt.status}
            {lastAttempt.status === "failed" && lastAttempt.error ? ` — ${lastAttempt.error}` : ""}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {message.direction === "inbound" && (
          <Link
            href={`/compose?reply=${message.id}`}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Reply
          </Link>
        )}
        {!inTrash && message.folder !== "archive" && (
          <form action={fileMessage}>
            <input type="hidden" name="id" value={message.id} />
            <input type="hidden" name="target" value="archive" />
            <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
              Archive
            </button>
          </form>
        )}
        {!inTrash ? (
          <form action={fileMessage}>
            <input type="hidden" name="id" value={message.id} />
            <input type="hidden" name="target" value="trash" />
            <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
              Trash
            </button>
          </form>
        ) : (
          <>
            <form action={fileMessage}>
              <input type="hidden" name="id" value={message.id} />
              <input type="hidden" name="target" value="inbox" />
              <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                Restore
              </button>
            </form>
            <form action={deleteForever}>
              <input type="hidden" name="id" value={message.id} />
              <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                Delete forever
              </button>
            </form>
          </>
        )}
      </div>

      <article className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">
        {message.body_text}
      </article>
    </main>
  );
}
