// Shared spring presets.
//
// `spring()` in Remotion is a physics simulation: a value eases from `from`
// toward `to` governed by mass / stiffness / damping. Rather than sprinkle
// magic numbers across templates, we name three feels and reuse them.
//
// Usage:
//   const v = spring({ frame, fps, config: SNAPPY });
//
// Tuning intuition:
//   - stiffness ↑  => faster, more urgent
//   - damping   ↓  => more overshoot / bounce (damping is the "brake")
//   - mass      ↑  => heavier, slower to start and stop
import type { SpringConfig } from "remotion";

// SNAPPY — fast settle, almost no overshoot. Good for UI-like reveals,
// callouts and lower-thirds that should feel crisp and professional.
export const SNAPPY: Partial<SpringConfig> = {
  mass: 0.6,
  stiffness: 180,
  damping: 20,
};

// GENTLE — slow, heavily damped glide with zero bounce. Good for backgrounds,
// slow pans and anything that should feel calm and expensive.
export const GENTLE: Partial<SpringConfig> = {
  mass: 1,
  stiffness: 60,
  damping: 26,
};

// BOUNCE — overshoots and wobbles back. Good for logo pops and playful accents.
// Keep it for a single hero element per scene; overuse reads as gimmicky.
export const BOUNCE: Partial<SpringConfig> = {
  mass: 0.8,
  stiffness: 140,
  damping: 9,
};
