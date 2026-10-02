/*
  Exploded-view part manifest for the XGIMI MoGo 4 Laser. Specs are the maker's published figures.
  In production this is read from the GLB's node extras.
*/
export type CanvasMode = '360' | 'exploded'

export interface Part {
  id: string
  name: string
  spec: string
  offset: number   // how far the part rises in the exploded view
  y: number        // part centre height when assembled (model units; the can is 2.36 tall)
}

export const PARTS: Part[] = [
  { id: 'shell', name: 'Shell', spec: 'Silver can, 207.6 × 96.5 mm, 1.32 kg', offset: 3.3, y: 1.15 },
  { id: 'optics', name: 'Laser engine', spec: 'Triple laser DLP, 1080p, 550 ISO lumens, ToF autofocus', offset: 1.25, y: 1.78 },
  { id: 'board', name: 'Mainboard', spec: 'Google TV, Wi-Fi 5, Bluetooth 5.1, HDMI ARC, USB-A', offset: 0.9, y: 1.3 },
  { id: 'audio', name: 'Speakers', spec: '2 × 6 W, Harman Kardon', offset: 0.6, y: 1.0 },
  { id: 'battery', name: 'Battery', spec: '71.28 Wh, up to 2.5 h in Eco, 65 W USB-C PD in', offset: 0.3, y: 0.5 },
  { id: 'stand', name: 'Stand', spec: 'Built-in base, 360° swivel with tilt', offset: 0, y: 0.08 },
]
