import { parseAddressList, planDispatch } from "../../lib/mail/plan";

describe("planDispatch", () => {
  const recipients = [
    { kind: "to" as const, address: "a@example.com" },
    { kind: "cc" as const, address: "b@example.com" },
    { kind: "to" as const, address: "c@example.com" },
  ];

  it("passes everything through when nothing is suppressed", () => {
    const plan = planDispatch(recipients, []);
    expect(plan.deliverable).toEqual(recipients);
    expect(plan.suppressed).toEqual([]);
  });

  it("withholds suppressed addresses and keeps the rest", () => {
    const plan = planDispatch(recipients, ["b@example.com"]);
    expect(plan.deliverable.map((r) => r.address)).toEqual(["a@example.com", "c@example.com"]);
    expect(plan.suppressed).toEqual(["b@example.com"]);
  });

  it("matches case-insensitively — addresses are citext in the schema", () => {
    const plan = planDispatch(recipients, ["A@EXAMPLE.COM", "C@Example.Com"]);
    expect(plan.deliverable.map((r) => r.address)).toEqual(["b@example.com"]);
    expect(plan.suppressed).toEqual(["a@example.com", "c@example.com"]);
  });

  it("can suppress every recipient, which the dispatcher records as 'suppressed'", () => {
    const plan = planDispatch(recipients, ["a@example.com", "b@example.com", "c@example.com"]);
    expect(plan.deliverable).toEqual([]);
    expect(plan.suppressed).toHaveLength(3);
  });
});

describe("parseAddressList", () => {
  it("splits on commas and trims whitespace", () => {
    expect(parseAddressList(" a@x.com , b@y.com ", "to")).toEqual([
      { kind: "to", address: "a@x.com" },
      { kind: "to", address: "b@y.com" },
    ]);
  });

  it("drops empty segments from trailing or doubled commas", () => {
    expect(parseAddressList("a@x.com,,b@y.com,", "to")).toHaveLength(2);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(parseAddressList("A@x.com,a@X.com", "to")).toEqual([{ kind: "to", address: "A@x.com" }]);
  });

  it("returns an empty list for an empty field", () => {
    expect(parseAddressList("", "cc")).toEqual([]);
  });
});
