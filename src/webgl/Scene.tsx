import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const INK = new THREE.Color('#101116')
const PAPER = new THREE.Color('#f0eee9')
const ACCENT = new THREE.Color('#df514b')

export interface SceneProps {
  /** Live predicted probability (0-1), the SAME value the 2D verdict badge shows --
   * this scene reads that state, it never maintains a second copy of the number. */
  proba: number
  /** Grouped attribution for the currently selected/perturbed case, same source as the
   * 2D attribution bars in chapter 3. */
  attribution: Record<string, number>
  /** 0-1 scroll progress across the page (useScrollProgress), drives camera position. */
  scrollProgress: number
  /** When true, camera holds a fixed position and ignores scroll progress entirely --
   * "one static frame," not merely slower motion. */
  staticFrame: boolean
}

/** The evidence core: a sphere at the scene origin. Color interpolates paper->accent with
 * probability (the same visual language the 2D verdict badge's red border uses); scale is
 * a static function of probability, not a continuously animated pulse, so the idle-render
 * budget (zero rAF when nothing is actually changing) isn't violated by decorative motion. */
function EvidenceCore({ proba }: { proba: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = PAPER.clone().lerp(ACCENT, proba)
  const scale = 1 + proba * 0.6
  return (
    <mesh ref={meshRef} scale={scale}>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} wireframe />
    </mesh>
  )
}

/** One plane per attribution feature, arranged in a ring around the core. Distance from
 * the core and color (accent for positive, paper-dim for negative) are driven by the
 * real attribution value for that feature -- the same numbers the 2D bars show, read
 * from the same `attribution` prop, not re-derived. */
function EvidencePlanes({ attribution }: { attribution: Record<string, number> }) {
  const entries = Object.entries(attribution)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8)
  return (
    <group>
      {entries.map(([feature, value], i) => {
        const angle = (i / entries.length) * Math.PI * 2
        const distance = 2.4 + Math.min(2, Math.abs(value) * 1.5)
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        const color = value >= 0 ? ACCENT : new THREE.Color('#c9c6bd')
        return (
          <mesh key={feature} position={[x, 0, z]} rotation={[0, -angle, 0]}>
            <planeGeometry args={[0.6, 0.9]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.55} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Scroll-tied camera: position interpolates along a fixed path as the user scrolls
 * through the 6 chapters, matching the Everswap-reference direction's request for
 * camera continuity. Only invalidates (requests a new frame) when scrollProgress
 * actually changes or staticFrame is false and mount just happened -- frameloop="demand"
 * on the parent Canvas means no frame renders otherwise, honoring the idle-render budget. */
function ScrollCamera({ scrollProgress, staticFrame }: { scrollProgress: number; staticFrame: boolean }) {
  const { camera, invalidate } = useThree()
  const target = staticFrame ? 0 : scrollProgress

  useEffect(() => {
    invalidate()
  }, [target, invalidate])

  useFrame(() => {
    const z = THREE.MathUtils.lerp(9, 3, target)
    const y = THREE.MathUtils.lerp(1.5, 0.2, target)
    camera.position.set(0, y, z)
    camera.lookAt(0, 0, 0)
  })

  return null
}

export default function Scene({ proba, attribution, scrollProgress, staticFrame }: SceneProps) {
  return (
    <>
      <color attach="background" args={[INK]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 4, 4]} intensity={60} color={ACCENT} />
      <pointLight position={[-4, -2, -4]} intensity={30} color={PAPER} />
      <EvidenceCore proba={proba} />
      <EvidencePlanes attribution={attribution} />
      <ScrollCamera scrollProgress={scrollProgress} staticFrame={staticFrame} />
    </>
  )
}
