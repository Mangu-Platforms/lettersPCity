import Link from "next/link";
import { listMessages, searchMessages, type Folder, type MessageSummary } from "@/lib/messages/queries";

export const dynamic = "force-dynamic";

const FOLDERS: { key: Folder; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "archive", label: "Archive" },
  { key: "trash", label: "Trash" },
];

function isFolder(value: string | undefined): value is Folder {
  return FOLDERS.some((f) => f.key === value);
}

/** What the ?sent= outcome actually means for the user, stated honestly. */
const SEND_BANNERS: Record<string, string> = {
  accepted: "Sent — the mail provider accepted your message.",
  skipped:
    "Saved to Sent. No mail provider is configured on this deployment, so nothing was delivered.",
  failed:
    "Saved to Sent, but the mail provider rejected the hand-off. Delivery did not happen.",
  suppressed:
    "Saved to Sent, but every recipient is on your suppression list, so nothing was delivered.",
};

function preview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { q?: string; folder?: string; sent?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  const folder: Folder = isFolder(searchParams.folder) ? searchParams.folder : "inbox";
  const banner = searchParams.sent ? SEND_BANNERS[searchParams.sent] : null;

  const messages: MessageSummary[] = query
    ? await searchMessages(query, { folder })
    : await listMessages(folder);

  const activeLabel = FOLDERS.find((f) => f.key === folder)?.label ?? "Inbox";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{activeLabel}</h1>
        <div className="flex items-baseline gap-4">
          <Link href="/settings/activity" className="text-sm text-muted underline">
            Activity
          </Link>
          <Link href="/settings/domains" className="text-sm text-muted underline">
            Domains
          </Link>
          <Link href="/compose" className="text-sm text-accent underline">
            Compose
          </Link>
        </div>
      </header>

      {banner && (
        <p className="mb-6 rounded-md border border-border px-3 py-2 text-sm text-muted">
          {banner}
        </p>
      )}

      <nav className="mb-6 flex gap-4 border-b border-border pb-2 text-sm">
        {FOLDERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "inbox" ? "/inbox" : `/inbox?folder=${f.key}`}
            className={f.key === folder ? "font-medium text-accent" : "text-muted"}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <form className="mb-6">
        {folder !== "inbox" && <input type="hidden" name="folder" value={folder} />}
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
