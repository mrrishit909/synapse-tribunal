/** Feature-detects WebGL with a throwaway canvas, BEFORE any Three.js code is imported --
 * the whole point is that an unsupported browser never fetches the renderer bundle at
 * all, not that it fetches it and then fails gracefully. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
