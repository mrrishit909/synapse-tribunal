import { useEffect, useState } from 'react'
import type { CalibrationFixture, ModelManifest, TestFixture, ThresholdSweep } from './types'

export interface FixturesLoading {
  status: 'loading'
}
export interface FixturesError {
  status: 'error'
  message: string
}
export interface FixturesReady {
  status: 'ready'
  manifest: ModelManifest
  fixture: TestFixture
  thresholdSweep: ThresholdSweep
  calibration: CalibrationFixture
}
export type FixturesState = FixturesLoading | FixturesError | FixturesReady

const FILES = ['model_manifest.json', 'test_fixture.json', 'threshold_sweep.json', 'calibration.json'] as const

/** Fetches the four small browser fixtures via BASE_URL, exactly the pattern CTY's
 * loadPanel.ts used, so this survives a GitHub Pages project-page base path untouched. */
export function useFixtures(): FixturesState & { retry: () => void } {
  const [state, setState] = useState<FixturesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    // This IS synchronizing with an external system (fetch), the canonical case the
    // rule's own message carves out as fine. Suppressed rather than worked around so
    // future fixture-loading hooks aren't tempted to copy an awkward workaround instead
    // of this same legitimate pattern.
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ status: 'loading' })
    const base = import.meta.env.BASE_URL
    Promise.all(
      FILES.map((name) =>
        fetch(`${base}data/precomputed/${name}`).then((r) => {
          if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`)
          return r.json()
        }),
      ),
    )
      .then(([manifest, fixture, thresholdSweep, calibration]) => {
        if (!cancelled) setState({ status: 'ready', manifest, fixture, thresholdSweep, calibration })
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { ...state, retry: () => setAttempt((a) => a + 1) }
}
