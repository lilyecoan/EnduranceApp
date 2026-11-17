"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Flag } from "lucide-react";
import { setTrainingGoal } from "@/lib/raceApi";
import { GOALS, goalLabel } from "@/lib/raceTypes";

type Props = {
  goal: string | null;
  raceName: string | null;
  onChanged: () => void;
};

/** What the athlete is training for: a race type, a gym plan, or general fitness. */
export function TrainingGoalCard({ goal, raceName, onChanged }: Props) {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = GOALS.find((g) => g.id === goal);

  async function choose(id: string) {
    setSaving(id);
    setError(null);
    try {
      await setTrainingGoal(await getToken(), id);
      onChanged();
    } catch {
      setError("Couldn't save your goal. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-[24px] border border-stroke bg-surface p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Flag className="w-4 h-4 text-lime" />
        <h3 className="text-sm font-semibold text-white">Training for</h3>
        {selected && <span className="text-[11px] text-fg/80">· {goalLabel(goal)}</span>}
      </div>
      <p className="text-[11px] text-muted mb-3">
        {selected?.race
          ? raceName
            ? <>Goal race: <b className="text-fg/80">{raceName}</b>. <Link href="/race" className="text-[#60a5fa] hover:underline">Edit race &amp; nutrition plan →</Link></>
            : <>Add the race itself (link, date, start time) on the <Link href="/race" className="text-[#60a5fa] hover:underline">Race tab →</Link></>
          : selected
            ? "No race needed. Pick a race type if you sign up for an event."
            : "Pick what you're training for so your coach plans around it."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => (
          <button key={g.id} type="button" aria-pressed={goal === g.id} disabled={!!saving} onClick={() => choose(g.id)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${goal === g.id
              ? "border-lime bg-lime/10 text-fg" : "border-stroke bg-surface2 text-fg/80 hover:border-muted"} disabled:opacity-60`}>
            {saving === g.id ? "Saving…" : g.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] text-[#f87171] mt-2">{error}</p>}
    </div>
  );
}
