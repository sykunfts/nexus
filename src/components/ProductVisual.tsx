/*
  Stylised product renders as inline SVG. In production these are AVIF renders (and 9:16 UGC clips)
  from the product pipeline; here they are procedural so the prototype ships with no external assets.
*/
import { useId } from 'react'
import { Product, Visual } from '../lib/data'
import { cn } from '../lib/cn'

/** True for light finishes, so the procedural render and the 3D shell switch to the light material. */
export const isLightSwatch = (swatch: string) => {
  const m = swatch.match(/^#([0-9a-f]{6})$/i)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const l = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return l > 150
}

/**
 * The product picture: the supplied photo when one exists (photos/<id>-N.jpg embedded at build time),
 * otherwise the procedural render. `index` picks a gallery photo; it falls back to the first.
 */
export function ProductImage({ product, index = 0, hue, swatch, glow = false, className }: {
  product: Pick<Product, 'photos' | 'visual' | 'hue' | 'brand' | 'name' | 'variants'>
  index?: number
  hue?: number
  swatch?: string
  glow?: boolean
  className?: string
}) {
  const src = product.photos?.[index] ?? product.photos?.[0]
  if (src) {
    return <img src={src} alt={`${product.brand} ${product.name}`} loading="lazy" decoding="async" className={cn('block h-full w-full object-cover', className)} />
  }
  return <ProductVisual visual={product.visual} hue={hue ?? product.hue} swatch={swatch ?? product.variants[0]?.swatch} glow={glow} className={className} name={`${product.brand} ${product.name}`} />
}

interface Props {
  visual: Visual
  hue?: number
  swatch?: string
  className?: string
  glow?: boolean
  name?: string
}

export function ProductVisual({ visual, hue = 78, swatch = '#2b2b30', className, glow = true, name }: Props) {
  const uid = useId().replace(/:/g, '')
  const g = (name: string) => `${uid}-${name}`
  const wall = `url(#${g('wall')})`
  const body = `url(#${g('body')})`
  const bodyDark = `url(#${g('bodyDark')})`
  const metal = `url(#${g('metal')})`
  const spec = `url(#${g('spec')})`
  const edge = 'rgba(255,255,255,0.14)'
  const light = isLightSwatch(swatch)
  const gold = swatch === '#d8b25c'
  const bodyA = gold ? '#e2c27a' : light ? '#d7d9df' : '#2e2e34'
  const bodyB = gold ? '#8a6a2a' : light ? '#9ea2ab' : '#121215'
  const accent = `hsl(${hue} 90% 60%)`
  const ink = light ? '#1b1b1f' : '#fafafa'

  return (
    <svg viewBox="0 0 400 300" className={cn('block h-full w-full', className)} role="img" aria-hidden="true" focusable="false" data-name={name}>
      <defs>
        <radialGradient id={g('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#121820" stopOpacity="0.16" />
          <stop offset="70%" stopColor="#121820" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#121820" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('wall')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue + 30} 85% 64%)`} />
          <stop offset="32%" stopColor={`hsl(${hue} 80% 46%)`} />
          <stop offset="78%" stopColor="#0b0b0f" />
        </linearGradient>
        <linearGradient id={g('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bodyA} />
          <stop offset="100%" stopColor={bodyB} />
        </linearGradient>
        <linearGradient id={g('bodyDark')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f1f24" />
          <stop offset="100%" stopColor="#0c0c0f" />
        </linearGradient>
        <linearGradient id={g('metal')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8e8e96" />
          <stop offset="50%" stopColor="#d2d2d8" />
          <stop offset="100%" stopColor="#7b7b84" />
        </linearGradient>
        <linearGradient id={g('spec')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('beam')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('solar')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2a4a" />
          <stop offset="100%" stopColor="#0b1326" />
        </linearGradient>
        <linearGradient id={g('rainbow')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={`hsl(${hue} 90% 60%)`} />
          <stop offset="50%" stopColor={`hsl(${hue + 60} 90% 60%)`} />
          <stop offset="100%" stopColor={`hsl(${hue + 120} 90% 60%)`} />
        </linearGradient>
      </defs>

      {glow && <ellipse cx="200" cy="246" rx="150" ry="22" fill={`url(#${g('glow')})`} />}

      {visual === 'projector' && (
        <g>
          <polygon points="128,150 20,40 330,40" fill={`url(#${g('beam')})`} />
          <rect x="30" y="44" width="296" height="4" rx="2" fill={accent} opacity="0.5" />
          <rect x="76" y="118" width="248" height="112" rx="24" fill={body} stroke={edge} />
          <rect x="76" y="118" width="248" height="112" rx="24" fill={spec} />
          <circle cx="128" cy="174" r="34" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          <circle cx="128" cy="174" r="24" fill={wall} />
          <circle cx="128" cy="174" r="11" fill="#06060a" />
          <circle cx="120" cy="166" r="4" fill="#fff" opacity="0.6" />
          {Array.from({ length: 30 }).map((_, i) => (
            <circle key={i} cx={212 + (i % 10) * 9.5} cy={152 + Math.floor(i / 10) * 9.5} r="2" fill={light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.22)'} />
          ))}
          <circle cx="258" cy="208" r="9" fill={light ? '#f1f2f5' : '#1c1c22'} stroke={edge} />
          <circle cx="258" cy="208" r="3" fill={accent} />
          <rect x="106" y="232" width="36" height="6" rx="3" fill={bodyDark} />
          <rect x="258" y="232" width="36" height="6" rx="3" fill={bodyDark} />
        </g>
      )}

      {visual === 'projector-can' && (
        <g>
          {/* stand */}
          <ellipse cx="200" cy="250" rx="66" ry="11" fill={bodyDark} stroke={edge} />
          <rect x="134" y="236" width="132" height="14" rx="4" fill={bodyDark} />
          <ellipse cx="200" cy="236" rx="66" ry="11" fill={light ? '#dcdde2' : '#26262c'} stroke={edge} />
          {/* body */}
          <rect x="146" y="46" width="108" height="194" rx="10" fill={body} stroke={edge} />
          <rect x="146" y="46" width="108" height="194" rx="10" fill={spec} />
          <ellipse cx="200" cy="48" rx="54" ry="9" fill={light ? '#e9eaee' : '#3a3a42'} stroke={edge} />
          <ellipse cx="200" cy="48" rx="20" ry="3.5" fill={light ? '#c5c7ce' : '#111114'} />
          {/* lens on the upper front */}
          <circle cx="200" cy="106" r="31" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          <circle cx="200" cy="106" r="22" fill={wall} />
          <circle cx="200" cy="106" r="10" fill="#06060a" />
          <circle cx="192" cy="98" r="3.5" fill="#fff" opacity="0.6" />
          <circle cx="238" cy="78" r="2.5" fill={accent} />
          {/* speaker grille */}
          {Array.from({ length: 48 }).map((_, i) => (
            <circle key={i} cx={166 + (i % 8) * 9.7} cy={156 + Math.floor(i / 8) * 11} r="2" fill={light ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)'} />
          ))}
          <rect x="184" y="226" width="32" height="5" rx="2.5" fill={light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)'} />
        </g>
      )}

      {visual === 'scale' && (
        <g>
          <rect x="96" y="66" width="208" height="176" rx="16" fill={body} stroke={edge} />
          <rect x="96" y="66" width="208" height="176" rx="16" fill={spec} />
          <rect x="104" y="74" width="192" height="160" rx="12" fill="none" stroke={light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'} />
          {[[122, 92], [278, 92], [122, 216], [278, 216]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill={metal} opacity="0.8" />)}
          <rect x="156" y="92" width="88" height="34" rx="4" fill="#0a0a0c" stroke="rgba(255,255,255,0.2)" />
          <text x="200" y="116" textAnchor="middle" fontFamily="Martian Mono, monospace" fontSize="17" fontWeight="500" fill={accent}>72.4</text>
          <rect x="150" y="146" width="100" height="2" rx="1" fill={light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'} />
          <rect x="150" y="166" width="100" height="2" rx="1" fill={light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'} />
        </g>
      )}

      {visual === 'speaker' && (
        <g>
          <rect x="96" y="96" width="208" height="120" rx="22" fill={body} stroke={edge} />
          <rect x="96" y="96" width="208" height="120" rx="22" fill={spec} />
          {Array.from({ length: 70 }).map((_, i) => (
            <circle key={i} cx={118 + (i % 14) * 12} cy={122 + Math.floor(i / 14) * 15} r="2.2" fill={light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.2)'} />
          ))}
          <rect x="150" y="84" width="100" height="10" rx="5" fill={bodyDark} stroke={edge} />
          <circle cx="282" cy="108" r="3" fill={accent} />
          <rect x="120" y="216" width="160" height="6" rx="3" fill={bodyDark} />
        </g>
      )}

      {visual === 'lock' && (
        <g>
          <rect x="150" y="44" width="100" height="212" rx="24" fill={body} stroke={edge} />
          <rect x="150" y="44" width="100" height="212" rx="24" fill={spec} />
          <circle cx="200" cy="120" r="34" fill={bodyDark} stroke={edge} />
          <circle cx="200" cy="120" r="24" fill="none" stroke={light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
          <rect x="196" y="100" width="8" height="26" rx="3" fill={accent} />
          {[0, 1, 2].map((i) => <rect key={i} x="180" y={178 + i * 18} width="40" height="8" rx="4" fill={light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)'} />)}
          <circle cx="200" cy="236" r="4" fill={accent} />
        </g>
      )}

      {visual === 'band' && (
        <g>
          <path d="M120 150 C120 70 280 70 280 150 C280 230 120 230 120 150 Z" fill="none" stroke={bodyB} strokeWidth="30" />
          <path d="M120 150 C120 70 280 70 280 150 C280 230 120 230 120 150 Z" fill="none" stroke={body} strokeWidth="24" />
          <rect x="166" y="60" width="68" height="34" rx="10" fill={bodyDark} stroke={edge} />
          <rect x="178" y="70" width="44" height="14" rx="4" fill="#0a0a0c" />
          <circle cx="200" cy="77" r="3" fill={accent} />
        </g>
      )}

      {visual === 'watch' && (
        <g>
          <rect x="166" y="30" width="68" height="60" rx="14" fill={body} stroke={edge} />
          <rect x="166" y="210" width="68" height="60" rx="14" fill={body} stroke={edge} />
          <circle cx="200" cy="150" r="70" fill={body} stroke={edge} />
          <circle cx="200" cy="150" r="70" fill={spec} />
          <circle cx="200" cy="150" r="58" fill="#0a0a0c" />
          <circle cx="200" cy="150" r="58" fill="none" stroke={light ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)'} />
          {[0, 90, 180, 270].map((a) => <circle key={a} cx={200 + 48 * Math.cos((a * Math.PI) / 180)} cy={150 + 48 * Math.sin((a * Math.PI) / 180)} r="2" fill="rgba(255,255,255,0.6)" />)}
          <path d="M200 150 L200 112" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M200 150 L226 160" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <circle cx="200" cy="150" r="3" fill="#fff" />
          <rect x="268" y="130" width="10" height="24" rx="3" fill={bodyDark} stroke={edge} />
        </g>
      )}

      {visual === 'device' && (
        <g>
          <rect x="92" y="90" width="216" height="130" rx="18" fill={body} stroke={edge} />
          <rect x="92" y="90" width="216" height="130" rx="18" fill={spec} />
          <rect x="110" y="108" width="120" height="66" rx="6" fill="#0a0a0c" stroke="rgba(255,255,255,0.2)" />
          <path d="M122 160 L146 136 L166 150 L190 124 L214 146" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="266" cy="140" r="20" fill={bodyDark} stroke={edge} />
          <circle cx="266" cy="140" r="8" fill={light ? '#d7d9df' : '#2e2e34'} />
          {[0, 1, 2].map((i) => <rect key={i} x={118 + i * 34} y="186" width="22" height="8" rx="4" fill={light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)'} />)}
          <circle cx="290" cy="104" r="3" fill={accent} />
        </g>
      )}

      {visual === 'ring' && (
        <g>
          <ellipse cx="200" cy="156" rx="96" ry="62" fill="none" stroke={bodyB} strokeWidth="34" />
          <ellipse cx="200" cy="150" rx="96" ry="62" fill="none" stroke={body} strokeWidth="30" />
          <ellipse cx="200" cy="150" rx="96" ry="62" fill="none" stroke={spec} strokeWidth="30" />
          <ellipse cx="200" cy="150" rx="81" ry="47" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          {[[200, 198], [172, 193], [228, 193]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.5" fill={accent} opacity="0.9" />)}
        </g>
      )}

      {visual === 'powerbank' && (
        <g>
          <rect x="118" y="62" width="164" height="178" rx="24" fill={body} stroke={edge} />
          <rect x="118" y="62" width="164" height="178" rx="24" fill={spec} />
          <rect x="132" y="76" width="136" height="72" rx="8" fill={`url(#${g('solar')})`} stroke="rgba(255,255,255,0.18)" />
          {[0, 1, 2, 3].map((i) => <line key={i} x1={132 + (i + 1) * 27.2} y1="76" x2={132 + (i + 1) * 27.2} y2="148" stroke="rgba(255,255,255,0.12)" />)}
          <line x1="132" y1="112" x2="268" y2="112" stroke="rgba(255,255,255,0.12)" />
          <circle cx="200" cy="192" r="34" fill="none" stroke={light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)'} strokeWidth="6" />
          <circle cx="200" cy="192" r="34" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" strokeDasharray="6 6" />
          <rect x="186" y="236" width="28" height="8" rx="4" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={146 + i * 9} cy="162" r="2" fill={i < 3 ? accent : 'rgba(255,255,255,0.2)'} />)}
        </g>
      )}

      {visual === 'glasses' && (
        <g>
          <path d="M40 150 C70 140 110 140 140 150" fill="none" stroke={bodyA} strokeWidth="10" strokeLinecap="round" />
          <path d="M360 150 C330 140 290 140 260 150" fill="none" stroke={bodyA} strokeWidth="10" strokeLinecap="round" />
          <rect x="96" y="124" width="92" height="66" rx="22" fill={bodyA} />
          <rect x="212" y="124" width="92" height="66" rx="22" fill={bodyA} />
          <rect x="104" y="131" width="76" height="52" rx="18" fill={wall} opacity="0.85" />
          <rect x="220" y="131" width="76" height="52" rx="18" fill={wall} opacity="0.85" />
          <rect x="104" y="131" width="76" height="52" rx="18" fill={spec} />
          <rect x="220" y="131" width="76" height="52" rx="18" fill={spec} />
          <path d="M188 150 Q200 140 212 150" fill="none" stroke={bodyA} strokeWidth="8" />
          <circle cx="104" cy="134" r="5" fill="#0a0a0c" stroke="rgba(255,255,255,0.4)" />
          <circle cx="104" cy="134" r="2" fill={accent} />
        </g>
      )}

      {visual === 'cam' && (
        <g>
          <rect x="156" y="196" width="88" height="40" rx="12" fill={bodyDark} stroke={edge} />
          <circle cx="200" cy="140" r="62" fill={body} stroke={edge} />
          <circle cx="200" cy="140" r="62" fill={spec} />
          <circle cx="200" cy="146" r="30" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          <circle cx="200" cy="146" r="19" fill={wall} />
          <circle cx="200" cy="146" r="8" fill="#06060a" />
          <circle cx="194" cy="140" r="3" fill="#fff" opacity="0.6" />
          <circle cx="232" cy="112" r="3" fill={accent} />
        </g>
      )}

      {visual === 'strip' && (
        <g>
          <path d="M40 200 C100 100 150 240 210 140 S320 120 360 180" fill="none" stroke={`url(#${g('rainbow')})`} strokeWidth="26" strokeLinecap="round" opacity="0.9" />
          <path d="M40 200 C100 100 150 240 210 140 S320 120 360 180" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="26" strokeLinecap="round" strokeDasharray="2 14" />
          <rect x="310" y="196" width="60" height="30" rx="8" fill={body} stroke={edge} />
          <circle cx="340" cy="211" r="4" fill={accent} />
        </g>
      )}

      {visual === 'scooter' && (
        <g>
          <circle cx="92" cy="226" r="30" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
          <circle cx="92" cy="226" r="9" fill={bodyDark} />
          <circle cx="318" cy="226" r="30" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
          <circle cx="318" cy="226" r="9" fill={bodyDark} />
          <path d="M118 206 H292 L300 222 H110 Z" fill={body} stroke={edge} />
          <path d="M292 206 L310 196" stroke={bodyA} strokeWidth="8" strokeLinecap="round" />
          <path d="M104 206 L126 60" stroke={bodyA} strokeWidth="10" strokeLinecap="round" />
          <path d="M90 60 H162" stroke={bodyA} strokeWidth="10" strokeLinecap="round" />
          <circle cx="126" cy="76" r="8" fill={bodyDark} stroke={edge} />
          <circle cx="126" cy="76" r="2.5" fill={accent} />
          <rect x="150" y="196" width="100" height="6" rx="3" fill={accent} opacity="0.7" />
        </g>
      )}

      {visual === 'earbuds' && (
        <g>
          <rect x="130" y="150" width="140" height="80" rx="24" fill={body} stroke={edge} />
          <rect x="130" y="150" width="140" height="80" rx="24" fill={spec} />
          <circle cx="200" cy="222" r="2.5" fill={accent} />
          {[[150, 110], [250, 110]].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x} ${y} C${x + (i ? -34 : 34)} ${y - 26} ${x + (i ? -40 : 40)} ${y + 30} ${x + (i ? -6 : 6)} ${y + 34}`} fill="none" stroke={bodyA} strokeWidth="9" strokeLinecap="round" />
              <circle cx={x} cy={y + 2} r="18" fill={body} stroke={edge} />
              <circle cx={x} cy={y + 2} r="18" fill={spec} />
              <circle cx={x} cy={y + 2} r="5" fill="#0a0a0c" />
            </g>
          ))}
        </g>
      )}

      {visual === 'pin' && (
        <g>
          <circle cx="200" cy="150" r="58" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" strokeDasharray="8 8" />
          <rect x="152" y="104" width="96" height="92" rx="22" fill={body} stroke={edge} />
          <rect x="152" y="104" width="96" height="92" rx="22" fill={spec} />
          <circle cx="200" cy="150" r="14" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={193 + i * 3.5 - 7} y={144 + Math.abs(2 - i) * 2} width="2" height={12 - Math.abs(2 - i) * 4} rx="1" fill={accent} />)}
          <circle cx="228" cy="124" r="3" fill={accent}>
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {visual === 'printer' && (
        <g>
          <rect x="90" y="60" width="220" height="190" rx="12" fill="none" stroke={bodyA} strokeWidth="10" />
          <rect x="90" y="60" width="220" height="190" rx="12" fill="rgba(255,255,255,0.02)" />
          <rect x="110" y="218" width="180" height="12" rx="3" fill={bodyDark} stroke={edge} />
          <rect x="100" y="120" width="200" height="8" rx="4" fill={metal} />
          <rect x="186" y="118" width="28" height="30" rx="4" fill={bodyDark} stroke={edge} />
          <path d="M196 148 L204 148 L200 160 Z" fill={accent} />
          <path d="M170 218 L182 176 H218 L230 218 Z" fill={accent} opacity="0.85" />
          <rect x="300" y="200" width="18" height="40" rx="3" fill={bodyDark} stroke={edge} />
          <circle cx="309" cy="210" r="2.5" fill={accent} />
        </g>
      )}

      {visual === 'robovac' && (
        <g>
          <ellipse cx="200" cy="236" rx="120" ry="16" fill="rgba(0,0,0,0.4)" />
          <path d="M80 190 Q80 232 200 232 Q320 232 320 190 V170 H80 Z" fill={bodyDark} stroke={edge} />
          <ellipse cx="200" cy="170" rx="120" ry="42" fill={body} stroke={edge} />
          <ellipse cx="200" cy="170" rx="120" ry="42" fill={spec} />
          <ellipse cx="200" cy="150" rx="26" ry="9" fill={bodyDark} stroke={edge} />
          <ellipse cx="200" cy="142" rx="26" ry="9" fill={body} stroke={edge} />
          <ellipse cx="200" cy="142" rx="6" ry="2.5" fill={accent} />
          <path d="M120 196 Q200 214 280 196" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
          <circle cx="170" cy="204" r="3" fill={accent} />
          <circle cx="230" cy="204" r="3" fill={accent} />
        </g>
      )}

      {visual === 'mask' && (
        <g>
          <path d="M110 92 Q200 56 290 92 Q318 150 290 214 Q250 252 200 252 Q150 252 110 214 Q82 150 110 92 Z" fill={body} stroke={edge} />
          <path d="M110 92 Q200 56 290 92 Q318 150 290 214 Q250 252 200 252 Q150 252 110 214 Q82 150 110 92 Z" fill={spec} />
          <ellipse cx="160" cy="138" rx="24" ry="14" fill="#09090b" />
          <ellipse cx="240" cy="138" rx="24" ry="14" fill="#09090b" />
          <ellipse cx="200" cy="210" rx="22" ry="8" fill="#09090b" />
          {Array.from({ length: 60 }).map((_, i) => {
            const x = 118 + (i % 12) * 15, y = 100 + Math.floor(i / 12) * 28
            const inEye = (Math.abs(x - 160) < 28 && Math.abs(y - 138) < 18) || (Math.abs(x - 240) < 28 && Math.abs(y - 138) < 18) || (Math.abs(x - 200) < 26 && Math.abs(y - 210) < 12)
            const inside = Math.hypot((x - 200) / 100, (y - 156) / 96) < 1
            return inEye || !inside ? null : <circle key={i} cx={x} cy={y} r="3" fill={`hsl(${hue} 95% 62%)`} opacity="0.9" />
          })}
        </g>
      )}

      {visual === 'screen' && (
        <g>
          <rect x="40" y="56" width="320" height="180" rx="4" fill={bodyDark} stroke={edge} />
          <rect x="52" y="68" width="296" height="156" fill={light ? '#f4f4f6' : '#15151a'} />
          <rect x="52" y="68" width="296" height="156" fill={wall} opacity={light ? 0.08 : 0.25} />
          <rect x="52" y="68" width="296" height="156" fill={spec} />
          <path d="M120 236 L96 268 M280 236 L304 268" stroke={bodyA} strokeWidth="6" strokeLinecap="round" />
          <rect x="60" y="246" width="280" height="8" rx="4" fill={bodyDark} stroke={edge} />
        </g>
      )}

      {visual === 'tag' && (
        <g>
          {[[262, 132, 0.5], [236, 116, 0.7]].map(([x, y, o]) => <circle key={x} cx={x} cy={y} r="46" fill={body} stroke={edge} opacity={o} />)}
          <circle cx="180" cy="160" r="54" fill={body} stroke={edge} />
          <circle cx="180" cy="160" r="54" fill={spec} />
          <circle cx="180" cy="160" r="40" fill="none" stroke={light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)'} strokeWidth="2" />
          <circle cx="180" cy="124" r="7" fill="#09090b" stroke={edge} />
          <circle cx="180" cy="160" r="4" fill={accent}>
            <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {visual === 'hub' && (
        <g>
          <ellipse cx="200" cy="200" rx="100" ry="18" fill="rgba(0,0,0,0.4)" />
          <path d="M110 150 V180 Q110 196 126 196 H274 Q290 196 290 180 V150 Z" fill={light ? '#dcdde2' : '#1f1f24'} stroke={edge} />
          <ellipse cx="200" cy="150" rx="90" ry="26" fill={body} stroke={edge} />
          <ellipse cx="200" cy="150" rx="90" ry="26" fill={spec} />
          <ellipse cx="200" cy="150" rx="46" ry="12" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.9" />
          <ellipse cx="200" cy="150" rx="46" ry="12" fill="none" stroke={accent} strokeWidth="8" opacity="0.15" />
        </g>
      )}

      {visual === 'charger' && (
        <g>
          <rect x="140" y="86" width="120" height="124" rx="24" fill={body} stroke={edge} />
          <rect x="140" y="86" width="120" height="124" rx="24" fill={spec} />
          <rect x="178" y="66" width="8" height="22" rx="2" fill={metal} transform="rotate(-12 182 77)" />
          <rect x="214" y="66" width="8" height="22" rx="2" fill={metal} transform="rotate(12 218 77)" />
          <rect x="186" y="188" width="28" height="10" rx="5" fill="#0a0a0c" stroke="rgba(255,255,255,0.25)" />
          <text x="200" y="146" textAnchor="middle" fontFamily="Martian Mono, monospace" fontSize="14" fontWeight="500" fill={ink}>100 W</text>
          <circle cx="200" cy="112" r="2" fill={accent} />
        </g>
      )}

      {visual === 'case' && (
        <g>
          <rect x="136" y="40" width="128" height="222" rx="26" fill={body} stroke={edge} />
          <rect x="136" y="40" width="128" height="222" rx="26" fill={spec} />
          <rect x="150" y="54" width="46" height="46" rx="14" fill="#0a0a0c" stroke="rgba(255,255,255,0.2)" />
          <circle cx="164" cy="68" r="6" fill={wall} />
          <circle cx="182" cy="86" r="6" fill={wall} />
          <circle cx="200" cy="168" r="40" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="7 5" opacity="0.8" />
          <rect x="190" y="166" width="20" height="4" rx="2" fill={accent} opacity="0.8" />
        </g>
      )}

      {visual === 'adapter' && (
        <g>
          <rect x="140" y="96" width="120" height="110" rx="18" fill={body} stroke={edge} />
          <rect x="140" y="96" width="120" height="110" rx="18" fill={spec} />
          <rect x="170" y="70" width="8" height="30" rx="2" fill={metal} transform="rotate(-30 174 85)" />
          <rect x="222" y="70" width="8" height="30" rx="2" fill={metal} transform="rotate(30 226 85)" />
          <rect x="196" y="62" width="8" height="34" rx="2" fill={metal} />
          <rect x="166" y="150" width="26" height="8" rx="2" fill="#0a0a0c" stroke="rgba(255,255,255,0.3)" transform="rotate(-30 179 154)" />
          <rect x="208" y="150" width="26" height="8" rx="2" fill="#0a0a0c" stroke="rgba(255,255,255,0.3)" transform="rotate(30 221 154)" />
          <rect x="196" y="166" width="8" height="26" rx="2" fill="#0a0a0c" stroke="rgba(255,255,255,0.3)" />
          <circle cx="200" cy="114" r="2.5" fill={accent} />
        </g>
      )}
    </svg>
  )
}
