import {
  checkDomainDns,
  evaluateTxtRecords,
  nextDomainStatus,
  verificationRecordName,
} from "../../lib/domains/verify";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("verificationRecordName", () => {
  it("prefixes the domain with _letters", () => {
    expect(verificationRecordName("author-one.com")).toBe("_letters.author-one.com");
  });
});

describe("evaluateTxtRecords", () => {
  it("verifies when any record equals the token", () => {
    expect(evaluateTxtRecords([["unrelated"], [TOKEN]], TOKEN).result).toBe("verified");
  });

  it("joins chunked TXT records before comparing — long records arrive split", () => {
    const half = TOKEN.length / 2;
    const evaluation = evaluateTxtRecords([[TOKEN.slice(0, half), TOKEN.slice(half)]], TOKEN);
    expect(evaluation.result).toBe("verified");
  });

  it("trims whitespace on both sides of the comparison", () => {
    expect(evaluateTxtRecords([[` ${TOKEN} `]], `${TOKEN} `).result).toBe("verified");
  });

  it("reports not_found when no records exist", () => {
    expect(evaluateTxtRecords([], TOKEN).result).toBe("not_found");
  });

  it("treats records that are empty after trimming as absent, not as a mismatch", () => {
    expect(evaluateTxtRecords([["  "]], TOKEN).result).toBe("not_found");
  });

  it("reports mismatch when records exist but none match, and returns what it found", () => {
    const evaluation = evaluateTxtRecords([["wrong-token"]], TOKEN);
    expect(evaluation.result).toBe("mismatch");
    expect(evaluation.found).toEqual(["wrong-token"]);
  });
});

describe("checkDomainDns", () => {
  it("queries the _letters record and passes resolver output to evaluation", async () => {
    const resolveTxt = jest.fn().mockResolvedValue([[TOKEN]]);
    const check = await checkDomainDns("author-one.com", TOKEN, resolveTxt);
    expect(resolveTxt).toHaveBeenCalledWith("_letters.author-one.com");
    expect(check.result).toBe("verified");
  });

  it.each(["ENOTFOUND", "ENODATA"])("maps %s to not_found — absence is normal, not an error", async (code) => {
    const err = Object.assign(new Error("queryTxt failed"), { code });
    const check = await checkDomainDns("author-one.com", TOKEN, jest.fn().mockRejectedValue(err));
    expect(check.result).toBe("not_found");
  });

  it("maps other resolver failures to dns_error with the message preserved", async () => {
    const err = Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
    const check = await checkDomainDns("author-one.com", TOKEN, jest.fn().mockRejectedValue(err));
    expect(check.result).toBe("dns_error");
    if (check.result === "dns_error") expect(check.error).toBe("timeout");
  });
});

describe("nextDomainStatus", () => {
  it("maps outcomes onto the domain status machine", () => {
    expect(nextDomainStatus("verified")).toBe("verified");
    expect(nextDomainStatus("not_found")).toBe("verifying");
    expect(nextDomainStatus("mismatch")).toBe("failed");
    // A DNS outage says nothing about ownership: status must not move.
    expect(nextDomainStatus("dns_error")).toBeNull();
  });
});
