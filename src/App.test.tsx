import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the loading state before fixtures resolve', () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent(/opening the case file/i)
  })
})
