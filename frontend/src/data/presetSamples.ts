import presetJson from '../../src_presets.json';

export interface PresetHeartbeat {
  id: string;
  label: 'N' | 'S' | 'V' | 'Q';
  name: string;
  description: string;
  clinicalMeaning: string;
  recordSource: string;
  features: number[];
}

export const PRESET_HEARTBEATS: PresetHeartbeat[] = [
  {
    id: 'sample-n',
    label: 'N',
    name: 'Normal Heartbeat (N)',
    description: 'Normal sinus beat or bundle branch block pattern from MIT-BIH Record 100.',
    clinicalMeaning: 'Typical depolarization and repolarization cycle (P-wave, QRS complex, T-wave).',
    recordSource: 'MIT-BIH Record 100 (Lead MLII)',
    features: (presetJson as Record<string, { features: number[] }>).N.features,
  },
  {
    id: 'sample-s',
    label: 'S',
    name: 'Supraventricular Ectopic Beat (S)',
    description: 'Premature atrial or junctional contraction arising from above the ventricles.',
    clinicalMeaning: 'Ectopic impulse originating in atria/AV node causing early heartbeat.',
    recordSource: 'MIT-BIH Record 100 (Lead MLII)',
    features: (presetJson as Record<string, { features: number[] }>).S.features,
  },
  {
    id: 'sample-v',
    label: 'V',
    name: 'Ventricular Ectopic Beat (V)',
    description: 'Premature ventricular contraction (PVC) originating directly in ventricular myocardium.',
    clinicalMeaning: 'Wide, abnormal QRS morphology indicating premature ventricular origin.',
    recordSource: 'MIT-BIH Record 100 (Lead MLII)',
    features: (presetJson as Record<string, { features: number[] }>).V.features,
  },
  {
    id: 'sample-q',
    label: 'Q',
    name: 'Unclassifiable / Paced Beat (Q)',
    description: 'Paced beat or artifact heartbeat window from MIT-BIH Record 101.',
    clinicalMeaning: 'Artificial pacemaker spike or unclassifiable waveform morphology.',
    recordSource: 'MIT-BIH Record 101 (Lead MLII)',
    features: (presetJson as Record<string, { features: number[] }>).Q.features,
  },
];
