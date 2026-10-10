const FEATURE_LABELS: Record<string, string> = {
  age: 'Age',
  workclass: 'Employment sector',
  'education-num': 'Years of schooling',
  'marital-status': 'Marital status',
  occupation: 'Occupation',
  relationship: 'Household relationship',
  race: 'Race',
  sex: 'Sex',
  'capital-gain': 'Capital gain ($)',
  'capital-loss': 'Capital loss ($)',
  'hours-per-week': 'Hours worked / week',
  'native-country': 'Native country',
}

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

export function formatValue(v: number | string): string {
  return typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : v
}
