import { describe, expect, it } from 'vitest'
import { supportsWebGL } from './supportsWebGL'

describe('supportsWebGL', () => {
  it('returns a boolean and does not throw in an environment without real WebGL (jsdom)', () => {
    // jsdom's canvas.getContext('webgl') is not implemented; this must degrade to
    // false, not crash -- the WebGLStage fallback path depends on exactly this.
    expect(() => supportsWebGL()).not.toThrow()
    expect(typeof supportsWebGL()).toBe('boolean')
  })
})
