import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function sendMessage(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/compose");

  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const mailboxId = String(formData.get("mailbox_id") ?? "");

  if (!to || !mailboxId) redirect("/compose?error=missing-fields");

  const { data: mailbox, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address")
    .eq("id", mailboxId)
    .maybeSingle();
  // RLS scopes this to the user's own mailboxes, so a foreign id reads as null.
  if (mailboxError || !mailbox) redirect("/compose?error=unknown-mailbox");

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      mailbox_id: mailbox.id,
      owner_id: user.id,
      direction: "outbound",
      folder: "sent",
      message_id: `<${randomUUID()}@letters>`,
      from_address: mailbox.address,
      subject,
      body_text: body,
    })
    .select("id")
    .single();

  if (error || !message) redirect("/compose?error=send-failed");

  await supabase
    .from("message_recipients")
    .insert(to.split(",").map((address) => ({
      message_id: message.id,
      kind: "to" as const,
      address: address.trim(),
    })));

  // Handing the message to an outbound MTA is not wired yet -- see
  // docs/INBOUND_MAIL.md. The message is stored in Sent either way.
  redirect("/inbox?sent=1");
}

export default async function ComposePage() {
  const supabase = createClient();
  const { data: mailboxes } = await supabase
    .from("mailboxes")
    .select("id, address, is_default")
    .order("is_default", { ascending: false });

  const options = mailboxes ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Compose</h1>

      {options.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          You need a verified domain and a mailbox before you can send.{" "}
          <Link href="/settings/domains" className="text-accent underline">
            Set up a domain
          </Link>
          .
        </p>
      ) : (
        <form action={sendMessage} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            From
            <select
              name="mailbox_id"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              name="to"
              required
              placeholder="someone@example.com"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Subject
            <input
              name="subject"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Message
            <textarea
              name="body"
              rows={12}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="mt-2 self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Send
          </button>
        </form>
      )}
    </main>
  );
}
