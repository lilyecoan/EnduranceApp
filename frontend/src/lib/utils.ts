import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secondsPerKm: number): string {
  const secondsPerMile = secondsPerKm * 1.60934;
  const m = Math.floor(secondsPerMile / 60);
  const s = Math.round(secondsPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

export function daysUntil(dateStr: string): number {
  const race = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

export function weeksUntil(dateStr: string): number {
  return Math.floor(daysUntil(dateStr) / 7);
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-cyan-400";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 65) return "bg-cyan-500/10 border-cyan-500/30";
  if (score >= 45) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}
