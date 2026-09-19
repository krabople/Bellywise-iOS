import { SymptomDefinition } from './types';

export const BUILT_IN_SYMPTOMS: SymptomDefinition[] = [
  { id: 'bloating', name: 'Bloating', kind: 'negative', icon: 'ellipse-outline' },
  { id: 'abdominal-pain', name: 'Abdominal pain', kind: 'negative', icon: 'pulse-outline' },
  { id: 'gas', name: 'Gas', kind: 'negative', icon: 'cloud-outline' },
  { id: 'diarrhoea', name: 'Loose stools', kind: 'negative', icon: 'water-outline' },
  { id: 'constipation', name: 'Constipation', kind: 'negative', icon: 'pause-circle-outline' },
  { id: 'nausea', name: 'Nausea', kind: 'negative', icon: 'sad-outline' },
  { id: 'reflux', name: 'Heartburn / reflux', kind: 'negative', icon: 'flame-outline' },
  { id: 'headache', name: 'Headache', kind: 'negative', icon: 'flash-outline' },
  { id: 'fatigue', name: 'Low energy', kind: 'negative', icon: 'battery-dead-outline' },
  { id: 'brain-fog', name: 'Brain fog', kind: 'negative', icon: 'cloudy-outline' },
  { id: 'skin', name: 'Skin changes', kind: 'negative', icon: 'hand-left-outline' },
  { id: 'comfortable', name: 'Comfortable digestion', kind: 'positive', icon: 'happy-outline' },
  { id: 'energy', name: 'Good energy', kind: 'positive', icon: 'sunny-outline' },
  { id: 'clear-headed', name: 'Clear-headed', kind: 'positive', icon: 'sparkles-outline' },
];
