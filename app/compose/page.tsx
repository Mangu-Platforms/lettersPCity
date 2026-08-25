import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dispatchOutbound } from "@/lib/mail/dispatch";
import { parseAddressList } from "@/lib/mail/plan";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const addressSchema = z.string().email();

async function sendMessage(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/compose");

  const to = String(formData.get("to") ?? "").trim();
  const cc = String(formData.get("cc") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const mailboxId = String(formData.get("mailbox_id") ?? "");
  const replyToId = String(formData.get("reply_to_id") ?? "");

  if (!to || !mailboxId) redirect("/compose?error=missing-fields");

  // Replying threads the message: In-Reply-To carries the original's RFC
  // Message-ID, and thread_id groups the conversation (the original's
  // thread, or the original itself as the thread root). The lookup is
  // RLS-scoped, so a foreign id degrades to a plain send.
  let inReplyTo: string | null = null;
  let threadId: string | null = null;
  if (replyToId) {
    const { data: original } = await supabase
      .from("messages")
      .select("id, message_id, thread_id")
      .eq("id", replyToId)
      .maybeSingle();
    if (original) {
      inReplyTo = original.message_id;
      threadId = original.thread_id ?? original.id;
    }
  }

  const recipients = [...parseAddressList(to, "to"), ...parseAddressList(cc, "cc")];
  if (recipients.length === 0) redirect("/compose?error=missing-fields");
  if (recipients.some((r) => !addressSchema.safeParse(r.address).success)) {
    redirect("/compose?error=bad-address");
  }

  const { data: mailbox, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address")
    .eq("id", mailboxId)
    .maybeSingle();
  // RLS scopes this to the user's own mailboxes, so a foreign id reads as null.
  if (mailboxError || !mailbox) redirect("/compose?error=unknown-mailbox");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const rfcMessageId = `<${randomUUID()}@${mailbox.address.split("@")[1] ?? "letters"}>`;

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      mailbox_id: mailbox.id,
      owner_id: user.id,
      direction: "outbound",
      folder: "sent",
      message_id: rfcMessageId,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      from_address: mailbox.address,
      from_name: profile?.display_name || null,
      subject,
      body_text: body,
    })
    .select("id")
    .single();

  if (error || !message) redirect("/compose?error=send-failed");

  const { error: recipientsError } = await supabase.from("message_recipients").insert(
    recipients.map((r) => ({
      message_id: message.id,
      kind: r.kind,
      address: r.address,
    }))
  );
  if (recipientsError) redirect("/compose?error=send-failed");

  // The message is safely in Sent; now hand it to the provider. dispatch
  // records the outcome in send_attempts and never throws back into this
  // action — a provider outage must not turn into a lost draft.
  const outcome = await dispatchOutbound({
    messageRowId: message.id,
    ownerId: user.id,
    from: { address: mailbox.address, name: profile?.display_name || undefined },
    recipients,
    subject,
    text: body,
    messageId: rfcMessageId,
    inReplyTo: inReplyTo ?? undefined,
  });

  redirect(`/inbox?folder=sent&sent=${outcome}`);
}

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "A recipient and a sending mailbox are required.",
  "bad-address": "One of the recipient addresses is not a valid email address.",
  "unknown-mailbox": "That sending mailbox does not exist on your account.",
  "send-failed": "The message could not be saved. Nothing was sent — try again.",
};

export default async function ComposePage({
  searchParams,
}: {
  searchParams: { error?: string; reply?: string };
}) {
  const supabase = createClient();
  const { data: mailboxes } = await supabase
    .from("mailboxes")
    .select("id, address, is_default")
    .order("is_default", { ascending: false });

  const options = mailboxes ?? [];
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  // Reply prefill. RLS-scoped read: a foreign or bogus id just renders a
  // blank compose.
  let replyTo: { id: string; from_address: string; subject: string } | null = null;
  if (searchParams.reply) {
    const { data } = await supabase
      .from("messages")
      .select("id, from_address, subject")
      .eq("id", searchParams.reply)
      .maybeSingle();
    replyTo = data;
  }
  const prefillSubject = replyTo
    ? replyTo.subject.match(/^re:/i)
      ? replyTo.subject
      : `Re: ${replyTo.subject}`
    : "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Compose</h1>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          {errorMessage}
        </p>
      )}

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
          {replyTo && <input type="hidden" name="reply_to_id" value={replyTo.id} />}
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
              defaultValue={replyTo?.from_address ?? ""}
              placeholder="someone@example.com, another@example.com"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Cc
            <input
              name="cc"
              placeholder="optional"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Subject
            <input
              name="subject"
              defaultValue={prefillSubject}
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
