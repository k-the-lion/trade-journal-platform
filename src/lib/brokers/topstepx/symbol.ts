/** ProjectX root symbols → common tickers (EP → ES, ENQ → NQ, etc.) */
const ROOT_ALIASES: Record<string, string> = {
  EP: "ES",
  ENQ: "NQ",
  RTY: "RTY",
  MES: "MES",
  MNQ: "MNQ",
  MGC: "MGC",
  GC: "GC",
  CL: "CL",
  MCL: "MCL",
};

export function symbolFromContractId(contractId: string): string {
  const parts = contractId.split(".");
  const root = parts.length >= 4 ? parts[3]!.toUpperCase() : contractId.toUpperCase();
  return ROOT_ALIASES[root] ?? root;
}

export function pickContractSymbol(
  contractId: string,
  contract?: { name?: string; description?: string } | null
): string {
  const fromName = contract?.name?.trim();
  if (fromName) {
    const token = fromName.split(/[\s/]/)[0]?.toUpperCase();
    if (token && token.length <= 6) return token;
  }
  return symbolFromContractId(contractId);
}
