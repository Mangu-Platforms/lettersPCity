import Link from "next/link";
import { listMessages, searchMessages, type MessageSummary } from "@/lib/messages/queries";

export const dynamic = "force-dynamic";

function preview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  const messages: MessageSummary[] = query
    ? await searchMessages(query)
    : await listMessages("inbox");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <Link href="/compose" className="text-sm text-accent underline">
          Compose
        </Link>
      </header>

      <form className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search sender, subject, or body"
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </form>

      {messages.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No messages match “${query}”.` : "No messages yet."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {messages.map((m) => (
            <li key={m.id}>
              <Link href={`/inbox/${m.id}`} className="block py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className={m.is_read ? "text-muted" : "font-medium"}>
                    {m.from_name || m.from_address}
                  </span>
                  <time className="shrink-0 text-xs text-muted">
                    {new Date(m.received_at).toLocaleDateString()}
                  </time>
                </div>
                <div className={m.is_read ? "text-sm text-muted" : "text-sm"}>
                  {m.subject || "(no subject)"}
                </div>
                <div className="text-sm text-muted">{preview(m.body_text)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
