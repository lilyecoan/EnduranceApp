/** What an athlete can train for. Race keys match the backend's race types. */
export type GoalOption = { id: string; label: string; race: boolean; multisport?: boolean };

export const GOALS: GoalOption[] = [
  { id: "sprint", label: "Sprint triathlon", race: true, multisport: true },
  { id: "olympic", label: "Olympic triathlon", race: true, multisport: true },
  { id: "half_iron", label: "IRONMAN 70.3 / half", race: true, multisport: true },
  { id: "full_iron", label: "IRONMAN / full", race: true, multisport: true },
  { id: "five_k", label: "5K", race: true },
  { id: "ten_k", label: "10K", race: true },
  { id: "half_marathon", label: "Half marathon", race: true },
  { id: "marathon", label: "Marathon", race: true },
  { id: "ultramarathon", label: "Ultramarathon", race: true },
  { id: "other", label: "Other race", race: true },
  { id: "gym", label: "Gym / strength plan", race: false },
  { id: "general", label: "General fitness", race: false },
];

export const goalLabel = (id: string | null | undefined) => GOALS.find((g) => g.id === id)?.label ?? id ?? "";
export const isMultisport = (id: string | null | undefined) => !!GOALS.find((g) => g.id === id)?.multisport;
