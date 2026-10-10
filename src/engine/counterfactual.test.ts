import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findFeasibleFlip } from './counterfactual'
import { logisticProba } from './model'
import type { ModelManifest, TestFixture } from './types'

const DATA_DIR = resolve(import.meta.dirname, '../../public/data/precomputed')
const manifest: ModelManifest = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'model_manifest.json'), 'utf-8'),
)
const fixture: TestFixture = JSON.parse(
  readFileSync(resolve(DATA_DIR, 'test_fixture.json'), 'utf-8'),
)
const sampleRaw = fixture.rows[0].raw

describe('findFeasibleFlip: numeric actionable feature', () => {
  it('a feasible flip actually changes the thresholded decision', () => {
    const result = findFeasibleFlip(manifest, sampleRaw, 'hours-per-week', 0.5)
    if (result.feasible) {
      const before = logisticProba(manifest, sampleRaw) >= 0.5
      const after =
        logisticProba(manifest, { ...sampleRaw, 'hours-per-week': result.to_value }) >= 0.5
      expect(before).not.toBe(after)
    } else {
      expect(result.reason).toBeTruthy()
    }
  })

  it('at the observed max bound, reports feasible or infeasible without throwing', () => {
    const [, hi] = manifest.numeric_observed_bounds['hours-per-week']
    const atBound = { ...sampleRaw, 'hours-per-week': hi }
    expect(() => findFeasibleFlip(manifest, atBound, 'hours-per-week', 0.5)).not.toThrow()
  })
})

describe('findFeasibleFlip: integer snapping', () => {
  it('never returns a fractional to_value for an integer-valued feature', () => {
    for (const feature of ['hours-per-week', 'education-num', 'capital-gain', 'capital-loss']) {
      const result = findFeasibleFlip(manifest, sampleRaw, feature, 0.5)
      if (result.feasible && typeof result.to_value === 'number') {
        expect(Number.isInteger(result.to_value)).toBe(true)
      }
    }
  })
})

describe('findFeasibleFlip: categorical actionable feature', () => {
  it('returns feasible=false with a reason, or a real flipping category', () => {
    const result = findFeasibleFlip(manifest, sampleRaw, 'workclass', 0.5)
    if (!result.feasible) {
      expect(result.reason).toBeTruthy()
    } else {
      expect(manifest.categorical_categories['workclass']).toContain(result.to_value)
    }
  })
})

describe('findFeasibleFlip: immutable feature rejection', () => {
  it('throws rather than silently searching a protected/immutable feature', () => {
    expect(() => findFeasibleFlip(manifest, sampleRaw, 'age', 0.5)).toThrow()
    expect(() => findFeasibleFlip(manifest, sampleRaw, 'sex', 0.5)).toThrow()
  })
})
