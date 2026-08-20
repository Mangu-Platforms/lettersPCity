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
      </div>

      <article className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">
        {message.body_text}
      </article>
    </main>
  );
}
