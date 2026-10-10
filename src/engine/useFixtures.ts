import { useEffect, useState } from 'react'
import type { ModelManifest, TestFixture } from './types'

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
}
export type FixturesState = FixturesLoading | FixturesError | FixturesReady

/** Fetches the two small browser fixtures via BASE_URL, exactly the pattern CTY's
 * loadPanel.ts used, so this survives a GitHub Pages project-page base path untouched. */
export function useFixtures(): FixturesState & { retry: () => void } {
  const [state, setState] = useState<FixturesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}data/precomputed/model_manifest.json`).then((r) => {
        if (!r.ok) throw new Error(`model_manifest.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch(`${base}data/precomputed/test_fixture.json`).then((r) => {
        if (!r.ok) throw new Error(`test_fixture.json: HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([manifest, fixture]) => {
        if (!cancelled) setState({ status: 'ready', manifest, fixture })
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
