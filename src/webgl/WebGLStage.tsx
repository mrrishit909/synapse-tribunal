import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { supportsWebGL } from './supportsWebGL'
import Scene, { type SceneProps } from './Scene'
import './WebGLStage.css'

export interface WebGLStageProps {
  proba: number
  attribution: Record<string, number>
  scrollProgress: number
  reducedMotion: boolean
}

/** Persistent, fixed-position WebGL background layer, pointer-events: none so it never
 * intercepts clicks meant for the 2D chapter content above it. Three.js/R3F/Drei are
 * dynamically imported (React.lazy) so an unsupported browser, or one where WebGL feature
 * detection fails, never fetches that bundle at all -- see docs/PERFORMANCE_BUDGETS.md's
 * kill criteria. Falls back to a plain CSS gradient (no canvas) on: no WebGL support,
 * context loss that doesn't recover, or prefers-reduced-motion (which still gets a
 * rendered canvas, per the budget doc, but with a static, non-scroll-driven camera --
 * only reduced-motion-but-WebGL-missing falls all the way back to the plain div). */
export default function WebGLStage({ proba, attribution, scrollProgress, reducedMotion }: WebGLStageProps) {
  const [webglAvailable] = useState(supportsWebGL)
  const [contextLost, setContextLost] = useState(false)
  const lostAtRef = useRef<number | null>(null)

  // Real bug found on WebKit: after context loss, Three.js's own internal renderer can
  // throw an uncaught exception (calling a GL method on the now-invalid context) from
  // inside its own requestAnimationFrame-driven render call -- NOT during React's render
  // phase, so WebGLErrorBoundary (which only catches render-phase errors) never sees it;
  // the exception surfaces as a `window` 'error' event instead. An earlier version of
  // this listener caught EVERY window error while mounted, not just WebGL-related ones --
  // an independent review proved this empirically (threw an unrelated, synchronous JS
  // error unconnected to WebGL; the renderer was permanently killed for the rest of the
  // session with no recovery path, since contextLost only clears on an actual
  // webglcontextrestored event). Scoped here instead to errors that actually originate
  // from the WebGL chunk: its filename carries a stable "WebGLStage" prefix in both the
  // production build (content-hashed chunk name) and dev (module path), checked against
  // both event.filename and the error's own stack as a fallback for engines that omit
  // filename on same-origin errors.
  useEffect(() => {
    const isFromWebGLChunk = (event: ErrorEvent): boolean => {
      const needle = /webglstage/i
      if (event.filename && needle.test(event.filename)) return true
      const stack = event.error instanceof Error ? event.error.stack : undefined
      return !!stack && needle.test(stack)
    }
    const onWindowError = (event: ErrorEvent) => {
      if (isFromWebGLChunk(event)) setContextLost(true)
    }
    window.addEventListener('error', onWindowError)
    return () => window.removeEventListener('error', onWindowError)
  }, [])

  if (!webglAvailable || contextLost) {
    return <div className="webgl-fallback" data-testid="webgl-fallback" aria-hidden="true" />
  }

  const sceneProps: SceneProps = { proba, attribution, scrollProgress, staticFrame: reducedMotion }

  return (
    <div className="webgl-stage" aria-hidden="true" data-testid="webgl-stage">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: 50, position: [0, 1.5, 9] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            lostAtRef.current = Date.now()
            setContextLost(true)
          })
          gl.domElement.addEventListener('webglcontextrestored', () => {
            // Bounded recovery window (docs/PERFORMANCE_BUDGETS.md kill criteria):
            // only resume if the loss was brief, not a sustained GPU problem.
            const elapsed = lostAtRef.current ? Date.now() - lostAtRef.current : Infinity
            if (elapsed < 5000) setContextLost(false)
          })
        }}
      >
        <Scene {...sceneProps} />
      </Canvas>
    </div>
  )
}
