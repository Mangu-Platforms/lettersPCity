import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Letters</h1>
      <p className="text-lg text-muted">
        Privacy-first email on your own domain. Built for indie creators.
      </p>
      <div>
        <Link
          href="/inbox"
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Open inbox
        </Link>
      </div>
    </main>
  );
}
