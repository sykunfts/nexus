/* Exploded-view part manifest for the Halo Beam 4K. In production this is read from the GLB's node extras. */
export type CanvasMode = '360' | 'exploded'

export interface Part {
  id: string
  name: string
  spec: string
  offset: number   // how far the part rises in the exploded view
  y: number        // part centre height when assembled
}

export const PARTS: Part[] = [
  { id: 'shell', name: 'Top shell', spec: 'Anodised aluminium, touch dial, 26 dB airflow', offset: 1.6, y: 0.9 },
  { id: 'optics', name: 'Laser engine', spec: 'Triple-laser DLP, 4K, 1,200 ISO lumens, ToF autofocus', offset: 1.05, y: 0.8 },
  { id: 'board', name: 'Mainboard', spec: 'Quad-core, Wi-Fi 6, HDMI 2.1 eARC, Halo OS', offset: 0.65, y: 0.56 },
  { id: 'audio', name: 'Speakers', spec: '2 × 8 W, Dolby Audio, passive radiators', offset: 0.5, y: 0.42 },
  { id: 'battery', name: 'Battery', spec: '65 Wh, 2.5 h, 65 W USB-C PD in', offset: 0.2, y: 0.42 },
  { id: 'base', name: 'Base', spec: 'Kickstand −5° to 15°, ¼″ tripod mount', offset: 0, y: 0.15 },
]
