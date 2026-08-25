import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dispatchOutbound } from "@/lib/mail/dispatch";
import { parseAddressList } from "@/lib/mail/plan";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const addressSchema = z.string().email();

/**
 * One action, two intents (the Send and Save-draft buttons carry them).
 *
 * Drafts never mutate message rows: the column grants deliberately keep
 * message content immutable to users (a mailbox where mail can be rewritten
 * is not a mailbox), so saving a draft inserts a fresh row and deletes the
 * previous one. Sending from a draft does the same — fresh Sent row, draft
 * deleted after the send is safely persisted.
 */
async function submitMessage(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/compose");

  const intent = String(formData.get("intent") ?? "send");
  const to = String(formData.get("to") ?? "").trim();
  const cc = String(formData.get("cc") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const mailboxId = String(formData.get("mailbox_id") ?? "");
  const replyToId = String(formData.get("reply_to_id") ?? "");
  const draftId = String(formData.get("draft_id") ?? "");
  const draftInReplyTo = String(formData.get("draft_in_reply_to") ?? "");
  const draftThreadId = String(formData.get("draft_thread_id") ?? "");

  if (!mailboxId) redirect("/compose?error=missing-fields");

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

  // Replying threads the message: In-Reply-To carries the original's RFC
  // Message-ID, and thread_id groups the conversation (the original's
  // thread, or the original itself as the thread root). The lookup is
  // RLS-scoped, so a foreign id degrades to a plain send.
  // When reopening a draft, use the draft's stored in_reply_to/thread_id;
  // when composing a fresh reply, look up the original's message_id/thread_id.
  let inReplyTo: string | null = null;
  let threadId: string | null = null;
  if (draftInReplyTo) {
    // Draft already has threading metadata; preserve it.
    inReplyTo = draftInReplyTo || null;
    threadId = draftThreadId || null;
  } else if (replyToId) {
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
  const rfcMessageId = `<${randomUUID()}@${mailbox.address.split("@")[1] ?? "letters"}>`;

  if (intent === "draft") {
    // A draft may be as incomplete as the writer likes — no recipient or
    // address validation until it tries to leave.
    const { data: draft, error } = await supabase
      .from("messages")
      .insert({
        mailbox_id: mailbox.id,
        owner_id: user.id,
        direction: "outbound",
        folder: "draft",
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
    if (error || !draft) redirect("/compose?error=draft-failed");

    if (recipients.length > 0) {
      await supabase.from("message_recipients").insert(
        recipients.map((r) => ({ message_id: draft.id, kind: r.kind, address: r.address }))
      );
    }
    if (draftId) {
      await supabase.from("messages").delete().eq("id", draftId).eq("folder", "draft");
    }
    redirect("/inbox?folder=draft&saved=1");
  }

  if (!to) redirect(composeUrl(draftId, "missing-fields"));
  if (recipients.length === 0) redirect(composeUrl(draftId, "missing-fields"));
  if (recipients.some((r) => !addressSchema.safeParse(r.address).success)) {
    redirect(composeUrl(draftId, "bad-address"));
  }

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

  if (error || !message) redirect(composeUrl(draftId, "send-failed"));

  const { error: recipientsError } = await supabase.from("message_recipients").insert(
    recipients.map((r) => ({
      message_id: message.id,
      kind: r.kind,
      address: r.address,
    }))
  );
  if (recipientsError) redirect(composeUrl(draftId, "send-failed"));

  // The message is now safely in Sent; the draft it came from is done.
  if (draftId) {
    await supabase.from("messages").delete().eq("id", draftId).eq("folder", "draft");
  }

  // Hand it to the provider. dispatch records the outcome in send_attempts
  // and never throws back into this action — a provider outage must not
  // turn into a lost message.
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

async function discardDraft(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/compose");

  await supabase
    .from("messages")
    .delete()
    .eq("id", String(formData.get("draft_id") ?? ""))
    .eq("folder", "draft");
  redirect("/inbox?folder=draft");
}

function composeUrl(draftId: string, error: string): string {
  return draftId ? `/compose?draft=${draftId}&error=${error}` : `/compose?error=${error}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  "missing-fields": "A recipient and a sending mailbox are required to send.",
  "bad-address": "One of the recipient addresses is not a valid email address.",
  "unknown-mailbox": "That sending mailbox does not exist on your account.",
  "send-failed": "The message could not be saved. Nothing was sent — try again.",
  "draft-failed": "The draft could not be saved. Try again.",
};

export default async function ComposePage({
  searchParams,
}: {
  searchParams: { error?: string; reply?: string; draft?: string };
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

  // Draft prefill, same posture. Only rows still in the draft folder open
  // for editing — a sent message is not a draft.
  // Fetch in_reply_to and thread_id to preserve reply threading across draft reopens.
  let draft:
    | {
        id: string;
        mailbox_id: string;
        subject: string;
        body_text: string;
        in_reply_to: string | null;
        thread_id: string | null;
        message_recipients: { kind: string; address: string }[];
      }
    | null = null;
  if (searchParams.draft) {
    const { data } = await supabase
      .from("messages")
      .select("id, mailbox_id, subject, body_text, folder, in_reply_to, thread_id, message_recipients(kind, address)")
      .eq("id", searchParams.draft)
      .eq("folder", "draft")
      .maybeSingle();
    draft = data;
  }

  const draftRecipients = draft?.message_recipients ?? [];
  const prefillTo =
    draft ? draftRecipients.filter((r) => r.kind === "to").map((r) => r.address).join(", ")
    : replyTo?.from_address ?? "";
  const prefillCc = draft
    ? draftRecipients.filter((r) => r.kind === "cc").map((r) => r.address).join(", ")
    : "";
  const prefillSubject = draft
    ? draft.subject
    : replyTo
      ? replyTo.subject.match(/^re:/i)
        ? replyTo.subject
        : `Re: ${replyTo.subject}`
      : "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {draft ? "Draft" : "Compose"}
      </h1>

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
        <>
          <form action={submitMessage} className="mt-6 flex flex-col gap-3">
            {replyTo && <input type="hidden" name="reply_to_id" value={replyTo.id} />}
            {draft && <input type="hidden" name="draft_id" value={draft.id} />}
            {draft?.in_reply_to && <input type="hidden" name="draft_in_reply_to" value={draft.in_reply_to} />}
            {draft?.thread_id && <input type="hidden" name="draft_thread_id" value={draft.thread_id} />}
            <label className="flex flex-col gap-1 text-sm">
              From
              <select
                name="mailbox_id"
                defaultValue={draft?.mailbox_id}
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
                defaultValue={prefillTo}
                placeholder="someone@example.com, another@example.com"
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Cc
              <input
                name="cc"
                defaultValue={prefillCc}
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
                defaultValue={draft?.body_text ?? ""}
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>

            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                name="intent"
                value="send"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Send
              </button>
              <button
                type="submit"
                name="intent"
                value="draft"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              >
                Save draft
              </button>
            </div>
          </form>

          {draft && (
            <form action={discardDraft} className="mt-3">
              <input type="hidden" name="draft_id" value={draft.id} />
              <button
                type="submit"
                className="text-sm text-muted underline"
              >
                Discard draft
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
