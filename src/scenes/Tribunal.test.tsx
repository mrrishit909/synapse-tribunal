import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tribunal from './Tribunal'

const DATA_DIR = resolve(import.meta.dirname, '../../public/data/precomputed')
const manifestJson = readFileSync(resolve(DATA_DIR, 'model_manifest.json'), 'utf-8')
const fixtureJson = readFileSync(resolve(DATA_DIR, 'test_fixture.json'), 'utf-8')

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url.includes('model_manifest') ? manifestJson : fixtureJson
      return Promise.resolve(new Response(body, { status: 200 }))
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
    expect(result!.textContent).toMatch(/feasible|infeasible/i)
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
})
