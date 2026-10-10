import { useRef, useState } from 'react'
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
