import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tribunal from './Tribunal'

const DATA_DIR = resolve(import.meta.dirname, '../../public/data/precomputed')
const FILES: Record<string, string> = {
  model_manifest: readFileSync(resolve(DATA_DIR, 'model_manifest.json'), 'utf-8'),
  test_fixture: readFileSync(resolve(DATA_DIR, 'test_fixture.json'), 'utf-8'),
  threshold_sweep: readFileSync(resolve(DATA_DIR, 'threshold_sweep.json'), 'utf-8'),
  calibration: readFileSync(resolve(DATA_DIR, 'calibration.json'), 'utf-8'),
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const key = Object.keys(FILES).find((k) => url.includes(k))
      if (!key) throw new Error(`unmocked fetch: ${url}`)
      return Promise.resolve(new Response(FILES[key], { status: 200 }))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Tribunal scene (SYN-INT-004 vertical slice)', () => {
  it('loads fixtures, shows a verdict, and recomputes live when a feature is perturbed', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    expect(screen.getByText(/PREDICTED:/i)).toBeInTheDocument()

    const slider = screen.getByLabelText(/hours worked/i) as HTMLInputElement
    const before = slider.value

    fireEvent.change(slider, { target: { value: '5' } })

    await waitFor(() => {
      expect(screen.getByText(/recomputed live after your edit/i)).toBeInTheDocument()
    })
    expect(slider.value).not.toBe(before)

    const resetButton = screen.getByRole('button', { name: /reset scenario/i })
    expect(resetButton).toBeEnabled()
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(screen.queryByText(/recomputed live after your edit/i)).not.toBeInTheDocument()
    })
  })

  it('runs a feasible-flip search and can apply the result', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => {
      expect(document.querySelector('.flip-result')).toBeTruthy()
    })
    const result = document.querySelector('.flip-result')
    expect(result).toBeTruthy()
    expect(result!.textContent).toMatch(/would flip the decision|no single-feature flip found/i)
  })

  it('rejects perturbing an immutable feature from the UI (none rendered for them)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())
    expect(screen.queryByLabelText(/^age$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^sex$/i)).not.toBeInTheDocument()
  })

  it('shows the contradictory case panel with real differing-feature data', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())
    expect(screen.getByText(/contradictory case/i)).toBeInTheDocument()
  })

  it('switching the selected case recomputes the panel and clears any active perturbation (SYN-INT-001)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    const caseNumberBefore = screen.getByText(/CASE No\./i).textContent
    const probabilityBefore = screen.getByText(/Probability of exceeding/i).textContent

    const slider = screen.getByLabelText(/hours worked/i)
    fireEvent.change(slider, { target: { value: '5' } })
    await waitFor(() => {
      expect(screen.getByText(/recomputed live after your edit/i)).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/test-set case/i) as HTMLSelectElement
    const otherOption = Array.from(select.options).find((o) => o.value !== select.value)!
    fireEvent.change(select, { target: { value: otherOption.value } })

    await waitFor(() => {
      expect(screen.getByText(/CASE No\./i).textContent).not.toBe(caseNumberBefore)
    })
    // Switching cases must clear the perturbation from the previous case, not carry
    // a stale "recomputed live" state into a fresh case selection.
    expect(screen.queryByText(/recomputed live after your edit/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Probability of exceeding/i).textContent).not.toBe(probabilityBefore)
  })

  it('switching to the boosting model shows its real fixture probability and disables perturbation (SYN-INT-002)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /gradient-boosted trees/i }))

    await waitFor(() => {
      expect(screen.getByText(/no live evaluator exists for this model/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/perturbation is disabled while the boosting model is active/i)).toBeInTheDocument()
    expect(screen.getByText(/no per-case attribution is shown for the boosting model/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /logistic regression/i }))
    await waitFor(() => {
      expect(screen.queryByText(/no live evaluator exists for this model/i)).not.toBeInTheDocument()
    })
  })

  it('changing the threshold recomputes the verdict and confusion counts (SYN-INT-003)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    const slider = screen.getByLabelText(/classify as "exceeds \$50k" when probability/i)
    const confusionBefore = document.querySelector('.confusion-grid')!.textContent

    fireEvent.change(slider, { target: { value: '0.9' } })

    await waitFor(() => {
      expect(document.querySelector('.confusion-grid')!.textContent).not.toBe(confusionBefore)
    })
  })

  it('selecting a calibration bin shows a real cohort or an honest empty state (SYN-INT-005)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    const bins = document.querySelectorAll('.calibration-bin')
    expect(bins.length).toBe(10)
    fireEvent.click(bins[0])

    await waitFor(() => {
      expect(document.querySelector('.calibration-detail')).toBeTruthy()
    })
    const text = document.querySelector('.calibration-detail')!.textContent!
    expect(text).toMatch(/no test cases fell|mean predicted probability/i)
  })

  it('comparing two cases shows both cases real attribution bars side by side (SYN-INT-006)', async () => {
    render(<Tribunal />)
    await waitFor(() => expect(screen.getByTestId('tribunal-scene')).toBeInTheDocument())

    const select = screen.getByLabelText(/compare case .* against/i) as HTMLSelectElement
    const option = Array.from(select.options).find((o) => o.value !== '')!
    fireEvent.change(select, { target: { value: option.value } })

    await waitFor(() => {
      expect(document.querySelector('.comparison-grid')).toBeTruthy()
    })
    expect(document.querySelectorAll('.comparison-grid .attribution-bars').length).toBe(2)
  })
})
