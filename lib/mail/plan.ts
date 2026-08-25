/**
 * Pure dispatch planning — which recipients a send may actually go to once
 * the owner's suppression list is applied. Kept free of Supabase/Next imports
 * so tests exercise it directly (the same layering as messages/signature.ts).
 */

export type RecipientKind = "to" | "cc" | "bcc";

export interface Recipient {
  kind: RecipientKind;
  address: string;
}

export interface DispatchPlan {
  /** Recipients the provider should actually receive. */
  deliverable: Recipient[];
  /** Addresses withheld because the owner's suppression list names them. */
  suppressed: string[];
}

export function planDispatch(
  recipients: Recipient[],
  suppressedAddresses: Iterable<string>
): DispatchPlan {
  const suppressedSet = new Set(
    Array.from(suppressedAddresses, (address) => address.toLowerCase())
  );
  const deliverable: Recipient[] = [];
  const suppressed: string[] = [];
  for (const recipient of recipients) {
    if (suppressedSet.has(recipient.address.toLowerCase())) {
      suppressed.push(recipient.address);
    } else {
      deliverable.push(recipient);
    }
  }
  return { deliverable, suppressed };
}

/**
 * Parses a comma-separated address field into trimmed, de-duplicated
 * recipients of one kind. Empty segments (trailing commas, double commas)
 * are dropped rather than sent to the provider as empty strings.
 */
export function parseAddressList(raw: string, kind: RecipientKind): Recipient[] {
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const segment of raw.split(",")) {
    const address = segment.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ kind, address });
  }
  return recipients;
}
