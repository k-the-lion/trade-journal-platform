import {
  PLAYBOOK_AUTO,
  PLAYBOOK_DEFAULT,
  PLAYBOOK_ORG,
} from "@/lib/ai/resolve-playbook";
import type { UserCoachPlaybook } from "@/lib/types/database";

export type PlaybookOption = {
  key: string;
  label: string;
  hint?: string;
};

export function buildPlaybookOptions(
  userPlaybooks: UserCoachPlaybook[],
  orgName: string | null
): PlaybookOption[] {
  const options: PlaybookOption[] = [
    {
      key: PLAYBOOK_AUTO,
      label: "Auto",
      hint: "Your default playbook, or coach group, or platform default",
    },
    {
      key: PLAYBOOK_DEFAULT,
      label: "Platform default",
    },
  ];

  if (orgName) {
    options.push({
      key: PLAYBOOK_ORG,
      label: `Coach group — ${orgName}`,
      hint: "Playbook set by your coach",
    });
  }

  for (const pb of userPlaybooks) {
    options.push({
      key: pb.id,
      label: pb.name + (pb.is_default ? " (default)" : ""),
      hint: `${pb.tone} tone`,
    });
  }

  return options;
}
