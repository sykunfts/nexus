/*
  The rules data in terms.json, checked against CJ-style titles: real products the rules must keep (they often list what is
  in the box or a feature: "With Remote", "Auto Bed Leveling", "Disc Brake", "With Case") and look-alikes they must throw out
  (straps, adapters, mounts, spare parts, jewellery). Add a line here whenever a rule changes.
*/
import { describe, expect, it } from 'vitest'
import watch from '../terms.json'
import { matchTitle } from '../src/match'
import type { Term } from '../src/types'

const t = (id: string): Term => (watch as Term[]).find((x) => x.id === id)!

const REAL: [string, string][] = [
  ['desk-3d-printer', 'Desktop 3D Printer With Auto Bed Leveling High Precision Printing'],
  ['desk-3d-printer', 'Mini 3D Printer For Kids Beginners With PLA Filament'],
  ['desk-3d-printer', 'FDM 3D Printer Large Size Heated Bed Silent Mainboard'],
  ['e-scooter', 'Electric Scooter Adult 10 Inch Pneumatic Tire 500W Motor Dual Brake'],
  ['e-scooter', 'Foldable Electric Scooter 350W With Disc Brake And APP Control'],
  ['laser-projector', 'Mini Projector 4K WiFi Bluetooth Portable Projector With Remote Control'],
  ['laser-projector', 'HY300 Portable Projector Android 11 With 180 Degree Rotating Stand'],
  ['battery-projector', 'Mini Portable Projector With Tripod Stand And Remote'],
  ['smart-lock', 'Smart Door Lock With Cat Eye Camera Fingerprint Password Unlock'],
  ['smart-lock', 'Fingerprint Smart Door Lock Keyless Entry Safe Home Security'],
  ['robot-vacuum', 'Robot Vacuum Cleaner 3 In 1 Sweeping Mopping With HEPA Filter'],
  ['window-robot', 'Window Cleaning Robot Automatic Glass Cleaner With 12 Cleaning Pads'],
  ['matter-hub', 'Tuya Zigbee 3.0 Wired Gateway Hub Ethernet Smart Home Bridge'],
  ['dev-board', 'Orange Pi 5 Single Board Computer 8GB RAM'],
  ['dev-board', 'Raspberry Pi 5 Starter Kit 8GB With Case And Power Supply'],
  ['recovery', 'Air Compression Leg Massager Boots For Circulation And Recovery'],
  ['recovery', 'Deep Tissue Percussion Massage Gun With 8 Heads'],
  ['fitness-band', 'M8 Smart Bracelet Sports Heart Rate Blood Pressure Waterproof Band'],
  ['smart-glasses', 'Smart Bluetooth Audio Sunglasses Open Ear Music Calls'],
  ['qi2-power-bank', 'Magnetic Wireless Power Bank 10000mAh MagSafe Case Compatible'],
  ['pocket-gimbal', 'Pocket Gimbal Camera 4K Handheld Vlog With Storage Case'],
  ['360-camera', '360 Panoramic Action Camera 5.7K With Selfie Stick'],
  ['finder-tag', 'Bluetooth Key Finder Anti-lost Tracker With Keychain Holder'],
  ['portable-speaker', 'Portable Wireless Bluetooth Speakers Waterproof Outdoor'],
  ['smart-ring', 'Smart Ring Sleep Tracker Heart Rate Blood Oxygen With Charging Case'],
  ['smartwatch', 'Ten-in-One Smart Watch Set With Wireless Earbuds, Multiple Watch Bands, Magnetic Charger & Protective Case'],
  ['gan-charger', '65W USB C Type-C Adapter Charger For DELL, HP, ASUS, Lenovo, Huawei,Acer Laptop'],
  ['ai-wearable', 'AI Voice Recorder Pendant Wearable Necklace With Transcription'],
  ['light-strip', 'Smart WiFi LED Strip Lights RGBIC 10m App Control'],
  ['indoor-camera', 'WiFi Indoor Security Camera 2K Pan Tilt Night Vision'],
  ['e-scooter', 'Electric Kick Scooter 8.5 Inch Foldable For Adults'],
]

const JUNK: [string, string][] = [
  ['gan-charger', 'USB C To USB A Adapter OTG Type-C Converter'],
  ['gan-charger', 'USB-C To 3.5mm Headphone Jack Adapter'],
  ['gan-charger', 'Type C To HDMI Adapter 4K'],
  ['ai-wearable', 'Heart Pendant Necklace For Women Gift'],
  ['ai-wearable', 'Cute Cartoon Metal Pin Badge'],
  ['smartwatch', 'Silicone Strap For Smart Watch 44mm'],
  ['smartwatch', 'Nylon Sport Loop Band For Apple Watch Series 9'],
  ['smartwatch', 'Magnetic Charger Cable For Smart Watch'],
  ['smart-ring', 'Smart Ring Charging Case Only (No Ring)'],
  ['smart-ring', 'Lymphatic Drainage Magnetic Therapy Ring Health Weight Loss'],
  ['smart-ring', 'Smart Ring Sizer Tool Kit'],
  ['fitness-band', 'Replacement Silicone Strap For Fitness Tracker Band'],
  ['projector-screen', 'Mini Projector 1080P Screen Mirroring Home Movie'],
  ['light-strip', 'LED Strip Light Connector 4 Pin RGB'],
  ['light-strip', 'Smart Power Strip WiFi 4 Outlets USB'],
  ['indoor-camera', 'Security Camera Wall Mount Bracket'],
  ['dev-board', 'Raspberry Pi 5 Active Cooler Fan'],
  ['recovery', 'Massage Gun Replacement Heads 6 Pack'],
  ['keyboard', 'Large Gaming Mouse Pad Keyboard Mat'],
  ['led-mask', 'Cyberpunk LED Mask Glowing Cosplay'],
  ['e-scooter', 'Foldable Kick Scooter For Kids 3 Wheels'],
  ['e-scooter', 'Electric Scooter Inner Tube 10 Inch Replacement'],
  ['travel-adapter', 'USB C To Lightning Adapter Universal'],
  ['laser-projector', 'Universal Projector Ceiling Mount Bracket'],
  ['laser-projector', 'Galaxy Star Projector Night Light For Bedroom'],
  ['robot-vacuum', 'Replacement Side Brush Filter Kit For Roborock S7'],
  ['desk-3d-printer', '3D Printer Nozzles 0.4mm 10pcs'],
  ['finder-tag', 'Silicone Case For AirTag Keychain Holder'],
  ['matter-hub', '4 Port USB Hub 3.0 Splitter'],
  ['matter-hub', 'Dual Band WiFi Router 5G'],
  ['qi2-power-bank', 'Magnetic Power Bank Silicone Case For iPhone'],
  ['360-camera', 'Selfie Stick For Insta360 Camera'],
]

describe('rules data against CJ-style titles', () => {
  it('keeps real products whose titles list what is in the box', () => {
    for (const [id, title] of REAL) {
      const m = matchTitle(title, t(id))
      expect(m.ok, `${id} should keep "${title}" (${m.ok ? '' : m.reason})`).toBe(true)
    }
  })
  it('throws out look-alikes and accessories', () => {
    for (const [id, title] of JUNK) expect(matchTitle(title, t(id)).ok, `${id} should reject "${title}"`).toBe(false)
  })
})
