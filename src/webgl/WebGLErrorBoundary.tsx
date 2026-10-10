import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * Without this, a real bug surfaced on WebKit: after WebGL context loss, Three.js's own
 * internal renderer throws an uncaught exception (calling a GL method on the now-invalid
 * context before our own `webglcontextlost` handler's React state update takes effect).
 * With no error boundary, React unmounts the ENTIRE app on an uncaught render error, not
 * just the WebGL layer -- the 2D interactive controls disappeared along with the canvas.
 * This violates the one hard rule the whole WebGL addition was built around (see
 * docs/PERFORMANCE_BUDGETS.md): "all 6 interactive controls... remain fully functional"
 * regardless of renderer state. An error boundary scoped to just the WebGL subtree keeps
 * a WebGL-internal crash from ever taking the 2D layer down with it.
 */
export default class WebGLErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('WebGL stage crashed; falling back to 2D-only background.', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
