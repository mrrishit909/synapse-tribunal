import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isActionable, logisticAttribution, logisticProba } from './model'
import type { ModelManifest, TestFixture } from './types'

const DATA_DIR = resolve(import.meta.dirname, '../../public/data/precomputed')
const manifest: ModelManifest = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'model_manifest.json'), 'utf-8'),
)
const fixture: TestFixture = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'test_fixture.json'), 'utf-8'),
)

describe('logisticProba parity against the Python/sklearn reference', () => {
  it('matches sklearn predict_proba for every sampled case within 1e-4', () => {
    let worst = 0
    for (const row of fixture.rows) {
      const proba = logisticProba(manifest, row.raw)
      worst = Math.max(worst, Math.abs(proba - row.logistic_proba))
    }
    expect(worst).toBeLessThan(1e-4)
  })

  it('stays within [0, 1] for every case', () => {
    for (const row of fixture.rows) {
      const proba = logisticProba(manifest, row.raw)
      expect(proba).toBeGreaterThanOrEqual(0)
      expect(proba).toBeLessThanOrEqual(1)
    }
  })
})

describe('logisticAttribution', () => {
  it('matches the Python reference attribution vector per feature', () => {
    for (const row of fixture.rows.slice(0, 50)) {
      const attrib = logisticAttribution(manifest, row.raw)
      for (let i = 0; i < attrib.length; i++) {
        expect(Math.abs(attrib[i] - row.logistic_attribution[i])).toBeLessThan(1e-4)
      }
    }
  })

  it('sums to logit(x) minus the train-mean logit (the SHAP round-trip invariant)', () => {
    for (const row of fixture.rows.slice(0, 50)) {
      const attrib = logisticAttribution(manifest, row.raw)
      const sum = attrib.reduce((a, b) => a + b, 0)
      const proba = logisticProba(manifest, row.raw)
      const logit = Math.log(proba / (1 - proba))
      expect(Math.abs(sum + manifest.logistic.attribution_base_logit - logit)).toBeLessThan(1e-3)
    }
  })
})

describe('isActionable', () => {
  it('flags actionable vs immutable features correctly, per the locked data contract', () => {
    expect(isActionable(manifest, 'hours-per-week')).toBe(true)
    expect(isActionable(manifest, 'age')).toBe(false)
    expect(isActionable(manifest, 'sex')).toBe(false)
  })
})
