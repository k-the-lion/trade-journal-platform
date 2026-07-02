import type { AccountType } from "@/lib/types/database";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  eval: "Eval",
  funded: "Funded",
  personal: "Personal",
  live: "Live",
  paper: "Paper",
};

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "paper", label: "Paper" },
  { value: "eval", label: "Eval" },
  { value: "funded", label: "Funded" },
  { value: "live", label: "Live" },
  { value: "personal", label: "Personal" },
];
