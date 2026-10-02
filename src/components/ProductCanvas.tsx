/*
  Interactive Product Canvas — React Three Fiber.
  360° orbit, exploded view with per-part callouts, keyboard rotation, reduced-motion aware.
  The Beam 4K here is procedural so the prototype needs no GLB; in production the same component
  loads a Draco GLB whose nodes carry `explode_offset` + `spec_key` in extras.
*/
import { Component, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from 'framer-motion'
import { CanvasMode, PARTS } from '../lib/parts'
import { cn } from '../lib/cn'
export type { CanvasMode }
export { PARTS }

const VOLT = new THREE.Color('#d2ff4a')
const ALU_DARK = '#2a2a30'
const ALU_LIGHT = '#c9ccd3'

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
    if (group.current) group.current.rotation.y += (rotation.current - group.current.rotation.y) * Math.min(1, dt * 8)
    invalidate()
  })

  const mat = (id: string, color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
    <meshStandardMaterial
      color={color}
      metalness={0.5}
      roughness={0.45}
      emissive={VOLT}
      emissiveIntensity={hovered === id ? 0.22 : 0}
      {...extra}
    />
  )
  const bind = (id: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(id) },
    onPointerOut: () => setHovered(null),
  })

  const fins = useMemo(() => Array.from({ length: 9 }, (_, i) => -0.9 + i * 0.1), [])
  const grille = useMemo(() => {
    const out: [number, number][] = []
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) out.push([-0.35 + c * 0.09, -0.16 + r * 0.1])
    return out
  }, [])

  return (
    <group ref={group} position={[0, -0.6, 0]}>
      {/* base */}
      <group ref={(el) => (parts.current.base = el)} {...bind('base')}>
        <RoundedBox args={[2.4, 0.3, 1.9]} radius={0.08} smoothness={4} position={[0, 0.15, 0]} castShadow receiveShadow>
          {mat('base', '#202026', { metalness: 0.3, roughness: 0.6 })}
        </RoundedBox>
        {[[-1.0, -0.75], [1.0, -0.75], [-1.0, 0.75], [1.0, 0.75]].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.01, z]}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
            <meshStandardMaterial color="#0b0b0e" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0.6]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[1.4, 0.03, 0.4]} />
          <meshStandardMaterial color={alu} metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* battery */}
      <group ref={(el) => (parts.current.battery = el)} {...bind('battery')}>
        <RoundedBox args={[1.5, 0.2, 0.7]} radius={0.03} position={[-0.15, 0.42, 0.4]} castShadow>
          {mat('battery', '#1b1b20', { metalness: 0.2, roughness: 0.6 })}
        </RoundedBox>
        <mesh position={[0.45, 0.42, 0.78]}>
          <boxGeometry args={[0.18, 0.08, 0.04]} />
          <meshStandardMaterial color="#d2ff4a" emissive={VOLT} emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* speakers */}
      <group ref={(el) => (parts.current.audio = el)} {...bind('audio')}>
        {[-0.98, 0.98].map((x) => (
          <mesh key={x} position={[x, 0.42, -0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.22, 32]} />
            {mat('audio', '#101014', { metalness: 0.4, roughness: 0.5 })}
          </mesh>
        ))}
        {[-0.98, 0.98].map((x) => (
          <mesh key={`c${x}`} position={[x * 1.12, 0.42, -0.1]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.02, 32]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* mainboard */}
      <group ref={(el) => (parts.current.board = el)} {...bind('board')}>
        <mesh position={[0, 0.56, -0.15]} castShadow>
          <boxGeometry args={[2.0, 0.03, 1.3]} />
          {mat('board', '#10251a', { metalness: 0.1, roughness: 0.55 })}
        </mesh>
        <mesh position={[0.5, 0.6, -0.3]} castShadow>
          <boxGeometry args={[0.42, 0.05, 0.42]} />
          <meshStandardMaterial color="#0b0b0e" metalness={0.8} roughness={0.25} emissive={VOLT} emissiveIntensity={hovered === 'board' ? 0.5 : 0.12} />
        </mesh>
        {fins.map((x) => (
          <mesh key={x} position={[x, 0.62, -0.55]}>
            <boxGeometry args={[0.02, 0.1, 0.4]} />
            <meshStandardMaterial color="#3a3a42" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {[0.2, 0.75].map((x) => (
          <mesh key={x} position={[x, 0.59, 0.25]}>
            <boxGeometry args={[0.3, 0.03, 0.2]} />
            <meshStandardMaterial color="#141418" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 0.6, -0.8]}>
          <boxGeometry args={[0.3, 0.08, 0.06]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* laser engine + lens */}
      <group ref={(el) => (parts.current.optics = el)} {...bind('optics')}>
        <RoundedBox args={[1.0, 0.36, 1.1]} radius={0.03} position={[-0.45, 0.8, 0.1]} castShadow>
          {mat('optics', '#1d1d23', { metalness: 0.6, roughness: 0.35 })}
        </RoundedBox>
        <mesh position={[-0.45, 0.8, 0.85]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.27, 0.27, 0.4, 48]} />
          <meshStandardMaterial color="#0e0e12" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[-0.45, 0.8, 1.055]}>
          <circleGeometry args={[0.22, 48]} />
          <meshStandardMaterial map={lens} emissive="#ffffff" emissiveMap={lens} emissiveIntensity={0.9} roughness={0.1} metalness={0} />
        </mesh>
        <mesh position={[-0.45, 0.8, 1.06]}>
          <ringGeometry args={[0.22, 0.27, 48]} />
          <meshStandardMaterial color="#d2ff4a" emissive={VOLT} emissiveIntensity={0.4} metalness={0.5} roughness={0.3} />
        </mesh>
        {mode === '360' && (
          <mesh position={[-0.45, 0.8, 2.7]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[1.1, 3.2, 32, 1, true]} />
            <meshBasicMaterial color="#d2ff4a" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* top shell */}
      <group ref={(el) => (parts.current.shell = el)} {...bind('shell')}>
        <RoundedBox args={[2.4, 0.9, 1.9]} radius={0.1} smoothness={4} position={[0, 0.75, 0]} castShadow receiveShadow>
          {mat('shell', alu, { metalness: 0.35, roughness: 0.5 })}
        </RoundedBox>
        <mesh position={[0, 0.82, 0.955]}>
          <boxGeometry args={[2.1, 0.4, 0.02]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.9} roughness={0.2} />
        </mesh>
        {grille.map(([x, y], i) => (
          <mesh key={i} position={[0.55 + x, 0.9 + y, 0.968]}>
            <circleGeometry args={[0.02, 8]} />
            <meshStandardMaterial color="#2a2a30" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0.7, 1.215, -0.4]}>
          <cylinderGeometry args={[0.16, 0.16, 0.03, 48]} />
          <meshStandardMaterial color={light ? '#f1f2f5' : '#111114'} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.7, 1.235, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.13, 48]} />
          <meshStandardMaterial color="#d2ff4a" emissive={VOLT} emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[1.205, 0.9, -0.1]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.1, 0.34]} />
          <meshStandardMaterial color="#0f0f13" roughness={0.8} />
        </mesh>
      </group>

      {/* callouts */}
      {PARTS.map((p) => {
        const show = hovered === p.id || (mode === 'exploded' && !hovered)
        if (!show) return null
        const y = p.y + p.offset * (mode === 'exploded' ? 1 : 0)
        return (
          <Html key={p.id} position={[1.5, y, 0.35]} zIndexRange={[10, 0]} className="pointer-events-none">
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
    const ty = mode === 'exploded' ? 0.75 : 0.05
    controls.target.y += (ty - controls.target.y) * k
    // dolly out for the exploded view so every part and callout stays in frame
    const want = mode === 'exploded' ? 9.6 : 7.2
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
}: {
  mode: CanvasMode
  light: boolean
  hue: number
  hovered: string | null
  setHovered: (id: string | null) => void
  fallback: ReactNode
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
        aria-label="Interactive 3D model of the Halo Beam 4K. Drag or use arrow keys to rotate; switch to exploded view to see components."
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
          camera={{ position: [4.4, 2.4, 5.0], fov: 30 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <hemisphereLight intensity={0.9} color="#e8ecff" groundColor="#0a0a0c" />
            <directionalLight position={[4, 7, 3]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-5, 3, -4]} intensity={0.25} color="#eaf7c4" />
            <spotLight position={[0, 9, 2]} intensity={8} angle={0.45} penumbra={1} />
            <directionalLight position={[2, 2, 6]} intensity={1.2} color="#ffffff" />
            <Projector mode={mode} hovered={hovered} setHovered={setHovered} light={light} hue={hue} rotation={rotation} reduce={reduce} />
            <ContactShadows position={[0, -0.61, 0]} opacity={0.55} scale={9} blur={2.6} far={3} />
            <OrbitControls
              enablePan={false}
              minDistance={4.5}
              maxDistance={12}
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
