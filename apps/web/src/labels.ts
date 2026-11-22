import type { Exercise } from '@stige/core';

export const TYPE_LABEL: Record<Exercise['type'], string> = {
  weight_reps: 'Vekt × reps',
  bodyweight: 'Kroppsvekt',
  assisted: 'Assistert',
  time: 'Tid',
  level: 'Nivå',
};

export function typeLabel(e: Exercise): string {
  if (e.type === 'level') return `Nivå · ${e.levelMetric === 'seconds' ? 'sekunder' : 'reps'}`;
  return TYPE_LABEL[e.type];
}
