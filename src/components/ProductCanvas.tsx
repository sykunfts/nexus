/*
  Interactive Product Canvas — React Three Fiber.
  360° orbit, exploded view with per-part callouts, keyboard rotation, reduced-motion aware.
  The MoGo 4 Laser here is procedural (an upright can, 2.15:1, to the maker's 207.6 × 96.5 mm) so the
  prototype needs no GLB; in production the same component loads a Draco GLB whose nodes carry
  `explode_offset` + `spec_key` in extras.
*/
import { Component, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from 'framer-motion'
import { CanvasMode, PARTS } from '../lib/parts'
import { cn } from '../lib/cn'
export type { CanvasMode }
export { PARTS }

const HOVER = new THREE.Color('#ff4a1f')
const ALU_DARK = '#2a2a30'
const ALU_LIGHT = '#c9ccd3'
const R = 0.55      // can radius
const H = 2.36      // can height

function useLensTexture(hue: number) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
    g.addColorStop(0, `hsl(${hue + 30} 90% 70%)`)
    g.addColorStop(0.45, `hsl(${hue} 85% 45%)`)
    g.addColorStop(1, '#06060a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [hue])
}

interface SceneProps {
  mode: CanvasMode
  hovered: string | null
  setHovered: (id: string | null) => void
  light: boolean
  hue: number
  rotation: React.MutableRefObject<number>
  reduce: boolean
}

function Projector({ mode, hovered, setHovered, light, hue, rotation, reduce }: SceneProps) {
  const t = useRef(0)
  const group = useRef<THREE.Group>(null)
  const parts = useRef<Record<string, THREE.Group | null>>({})
  const sleeve = useRef<THREE.MeshStandardMaterial>(null)
  const lens = useLensTexture(hue)
  const alu = light ? ALU_LIGHT : ALU_DARK
  const { invalidate } = useThree()

  useFrame((_, dt) => {
    const target = mode === 'exploded' ? 1 : 0
    const k = reduce ? 1 : Math.min(1, dt * 6)
    t.current += (target - t.current) * k
    for (const p of PARTS) {
      const g = parts.current[p.id]
      if (g) g.position.y = p.offset * t.current
    }
    // the sleeve goes translucent as it lifts, so the stack underneath stays readable
    if (sleeve.current) sleeve.current.opacity = 1 - 0.6 * t.current
    if (group.current) group.current.rotation.y += (rotation.current - group.current.rotation.y) * Math.min(1, dt * 8)
    invalidate()
  })

  const mat = (id: string, color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
    <meshStandardMaterial
      color={color}
      metalness={0.5}
      roughness={0.45}
      emissive={HOVER}
      emissiveIntensity={hovered === id ? 0.18 : 0}
      {...extra}
    />
  )
  const bind = (id: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(id) },
    onPointerOut: () => setHovered(null),
  })

  const grille = useMemo(() => {
    const out: [number, number, number][] = []
    for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {
      const a = -0.5 + c * 0.125
      out.push([Math.sin(a) * (R + 0.004), 0.55 + r * 0.1, Math.cos(a) * (R + 0.004)])
    }
    return out
  }, [])
  const fins = useMemo(() => Array.from({ length: 7 }, (_, i) => -0.27 + i * 0.09), [])

  return (
    <group ref={group} position={[0, -H / 2, 0]}>
      {/* stand: a swivel base with a hinge block */}
      <group ref={(el) => (parts.current.stand = el)} {...bind('stand')}>
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[R + 0.08, R + 0.12, 0.1, 64]} />
          {mat('stand', light ? '#9a9ca3' : '#202026', { metalness: 0.4, roughness: 0.55 })}
        </mesh>
        <mesh position={[0, 0.13, -0.05]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color="#0f0f13" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[R - 0.05, R + 0.02, 64]} />
          <meshStandardMaterial color="#0b0b0e" roughness={0.9} />
        </mesh>
      </group>

      {/* battery cell pack */}
      <group ref={(el) => (parts.current.battery = el)} {...bind('battery')}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.62, 48]} />
          {mat('battery', '#1b1b20', { metalness: 0.2, roughness: 0.6 })}
        </mesh>
        <mesh position={[0, 0.5, 0.41]}>
          <boxGeometry args={[0.24, 0.1, 0.02]} />
          <meshStandardMaterial color="#ff4a1f" emissive={HOVER} emissiveIntensity={0.35} />
        </mesh>
      </group>

      {/* speakers: two drivers facing out of the sides */}
      <group ref={(el) => (parts.current.audio = el)} {...bind('audio')}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.3, 1.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.22, 32]} />
            {mat('audio', '#101014', { metalness: 0.4, roughness: 0.5 })}
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`c${s}`} position={[s * 0.42, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 32]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* mainboard: a vertical board at the back with a heatsink */}
      <group ref={(el) => (parts.current.board = el)} {...bind('board')}>
        <mesh position={[0, 1.3, -0.3]} castShadow>
          <boxGeometry args={[0.7, 0.8, 0.03]} />
          {mat('board', '#10251a', { metalness: 0.1, roughness: 0.55 })}
        </mesh>
        <mesh position={[0.1, 1.35, -0.26]} castShadow>
          <boxGeometry args={[0.28, 0.28, 0.04]} />
          <meshStandardMaterial color="#0b0b0e" metalness={0.8} roughness={0.25} emissive={HOVER} emissiveIntensity={hovered === 'board' ? 0.4 : 0.08} />
        </mesh>
        {fins.map((x) => (
          <mesh key={x} position={[x, 1.08, -0.2]}>
            <boxGeometry args={[0.02, 0.22, 0.14]} />
            <meshStandardMaterial color="#3a3a42" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {/* ports on the back: HDMI, USB-A, USB-C */}
        {[[-0.16, 0.12, 0.04], [0.02, 0.1, 0.04], [0.16, 0.07, 0.03]].map(([x, w, h], i) => (
          <mesh key={i} position={[x, 1.62, -0.33]}>
            <boxGeometry args={[w, h, 0.03]} />
            <meshStandardMaterial color="#0a0a0c" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* laser engine + lens on the upper front */}
      <group ref={(el) => (parts.current.optics = el)} {...bind('optics')}>
        <mesh position={[0, 1.78, 0.05]} castShadow>
          <boxGeometry args={[0.6, 0.5, 0.6]} />
          {mat('optics', '#1d1d23', { metalness: 0.6, roughness: 0.35 })}
        </mesh>
        <mesh position={[0, 1.78, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.23, 0.23, 0.3, 48]} />
          <meshStandardMaterial color="#0e0e12" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.78, R + 0.025]}>
          <circleGeometry args={[0.19, 48]} />
          <meshStandardMaterial map={lens} emissive="#ffffff" emissiveMap={lens} emissiveIntensity={0.9} roughness={0.1} metalness={0} />
        </mesh>
        <mesh position={[0, 1.78, R + 0.03]}>
          <ringGeometry args={[0.19, 0.235, 48]} />
          <meshStandardMaterial color="#111114" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* ToF sensor window */}
        <mesh position={[0.3, 1.95, R + 0.02]}>
          <circleGeometry args={[0.035, 24]} />
          <meshStandardMaterial color="#06060a" roughness={0.3} />
        </mesh>
        {mode === '360' && (
          <mesh position={[0, 1.78, R + 1.7]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.95, 3.2, 32, 1, true]} />
            <meshBasicMaterial color="#ffd9c7" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* shell: the can sleeve and top cap */}
      <group ref={(el) => (parts.current.shell = el)} {...bind('shell')}>
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[R, R, 2.2, 64, 1, true]} />
          <meshStandardMaterial ref={sleeve} color={alu} metalness={0.35} roughness={0.5} transparent side={THREE.DoubleSide} emissive={HOVER} emissiveIntensity={hovered === 'shell' ? 0.18 : 0} />
        </mesh>
        <mesh position={[0, H - 0.05, 0]} castShadow>
          <cylinderGeometry args={[R + 0.006, R + 0.006, 0.14, 64]} />
          {mat('shell', light ? '#e9eaee' : '#3a3a42', { metalness: 0.4, roughness: 0.45 })}
        </mesh>
        <mesh position={[0, H + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.2, 48]} />
          <meshStandardMaterial color={light ? '#b9bcc3' : '#111114'} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {grille.map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0, Math.atan2(x, z), 0]}>
            <circleGeometry args={[0.014, 8]} />
            <meshStandardMaterial color={light ? '#5a5c63' : '#0a0a0c'} roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* callouts */}
      {PARTS.map((p) => {
        const show = hovered === p.id || (mode === 'exploded' && !hovered)
        if (!show) return null
        const y = p.y + p.offset * (mode === 'exploded' ? 1 : 0)
        return (
          <Html key={p.id} position={[R + 0.35, y, 0.2]} zIndexRange={[10, 0]} className="pointer-events-none">
            <div className={cn('flex -translate-y-1/2 items-center gap-2 whitespace-nowrap', hovered === p.id ? 'opacity-100' : 'opacity-85')}>
              <span className="h-px w-7 bg-signal" />
              <span className="bg-paper px-2 py-1 text-ink">
                <span className="block text-[11.5px] font-medium">{p.name}</span>
                {hovered === p.id && <span className="reading block text-[10px] font-normal text-ink-2">{p.spec}</span>}
              </span>
            </div>
          </Html>
        )
      })}
    </group>
  )
}

function Rig({ mode }: { mode: CanvasMode }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; object: THREE.Camera; update: () => void } | null
  useFrame((_, dt) => {
    if (!controls) return
    const k = Math.min(1, dt * 4)
    const ty = mode === 'exploded' ? 1.65 : 0
    controls.target.y += (ty - controls.target.y) * k
    // dolly out for the exploded view so every part and callout stays in frame
    const want = mode === 'exploded' ? 12.6 : 6.6
    const cam = controls.object
    const offset = cam.position.clone().sub(controls.target)
    const dist = offset.length()
    const next = dist + (want - dist) * k
    cam.position.copy(controls.target.clone().add(offset.multiplyScalar(next / dist)))
    controls.update()
  })
  return null
}

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function ProductCanvas({
  mode,
  light,
  hue,
  hovered,
  setHovered,
  fallback,
  label,
}: {
  mode: CanvasMode
  light: boolean
  hue: number
  hovered: string | null
  setHovered: (id: string | null) => void
  fallback: ReactNode
  label: string
}) {
  const reduce = !!useReducedMotion()
  const rotation = useRef(0)
  const [idle, setIdle] = useState(true)
  const [ok] = useState(hasWebGL)
  const idleTimer = useRef<number | null>(null)

  const poke = () => {
    setIdle(false)
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 4000)
  }
  useEffect(() => () => { if (idleTimer.current) window.clearTimeout(idleTimer.current) }, [])

  if (!ok) return <>{fallback}</>

  return (
    <CanvasBoundary fallback={fallback}>
      <div
        role="img"
        aria-label={`Interactive 3D model of the ${label}. Drag or use arrow keys to rotate; switch to exploded view to see components.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { rotation.current -= 0.35; poke() }
          if (e.key === 'ArrowRight') { rotation.current += 0.35; poke() }
        }}
        onPointerDown={poke}
        onWheel={poke}
        className="h-full w-full cursor-grab outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-signal"
      >
        <Canvas
          dpr={[1, 2]}
          shadows
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [3.6, 1.6, 5.2], fov: 30 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <hemisphereLight intensity={0.9} color="#e8ecff" groundColor="#0a0a0c" />
            <directionalLight position={[4, 7, 3]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-5, 3, -4]} intensity={0.25} color="#f3efe8" />
            <spotLight position={[0, 9, 2]} intensity={8} angle={0.45} penumbra={1} />
            <directionalLight position={[2, 2, 6]} intensity={1.2} color="#ffffff" />
            <Projector mode={mode} hovered={hovered} setHovered={setHovered} light={light} hue={hue} rotation={rotation} reduce={reduce} />
            <ContactShadows position={[0, -H / 2 - 0.01, 0]} opacity={0.55} scale={7} blur={2.4} far={3} />
            <OrbitControls
              enablePan={false}
              minDistance={4}
              maxDistance={15}
              minPolarAngle={0.5}
              maxPolarAngle={1.45}
              autoRotate={idle && !reduce && mode === '360' && !hovered}
              autoRotateSpeed={0.7}
              makeDefault
            />
            <Rig mode={mode} />
          </Suspense>
        </Canvas>
      </div>
    </CanvasBoundary>
  )
}
