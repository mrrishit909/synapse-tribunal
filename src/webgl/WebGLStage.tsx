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
  // the exception surfaces as a `window` 'error' event instead, and with no handler for
  // that, it was silently crashing more than this component could see. This listener is
  // the actual fix for that gap; the error boundary (in Tribunal.tsx) remains as a second
  // layer for genuine React-render-phase failures. Scoped to "while this stage is
  // mounted" since by then any uncaught error reaching window level is overwhelmingly
  // likely to be from the WebGL subsystem, not unrelated app code.
  useEffect(() => {
    const onWindowError = () => setContextLost(true)
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
