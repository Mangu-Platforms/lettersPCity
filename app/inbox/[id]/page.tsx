import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessage } from "@/lib/messages/queries";

export const dynamic = "force-dynamic";

export default async function MessagePage({ params }: { params: { id: string } }) {
  const message = await getMessage(params.id);
  // RLS turns "someone else's message" into "no rows", so this covers both
  // a missing id and an unauthorized one.
  if (!message) notFound();

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
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

      <article className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">
        {message.body_text}
      </article>
    </main>
  );
}
