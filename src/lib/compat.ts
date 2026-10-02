/*
  @nexus/compat — "works with your setup". A pure, synchronous rule engine.
  Same code runs in a Web Worker on the client and on the server as the source of truth.
  Input: the subject (product + chosen options) and the build (the shopper's setup + cart lines).
  Output: a rolled-up status, explainable issues, and priced fixes.

  Facets: companion-app OS · magnetic attach (Qi2/MagSafe) · finder network · smart-home protocol
  and Thread · plug type and voltage · physical inputs (HDMI) · charging power.
*/
import { CompatFacts, PORT_LABEL, PROTO_LABEL, PortKind, Product, REGION_LABEL } from './data'

export type Severity = 'ok' | 'warn' | 'bad'

export interface Fix {
  label: string
  kind: 'add-sku' | 'select-option'
  sku?: string
  optionGroup?: string
  choice?: string
}

export interface Issue {
  id: string
  severity: 'warn' | 'bad'
  title: string
  because: string
  fix?: Fix
}

export interface CompatResult {
  status: Severity
  issues: Issue[]
  checked: number
  summary: string
}

export interface BuildItem { id: string; name: string; facts: CompatFacts }

/** Merge a product's base facts with the facts of the chosen options. */
export function resolveFacts(product: Product, selection: Record<string, string>): CompatFacts {
  let facts: CompatFacts = { ...product.facts }
  for (const group of product.options ?? []) {
    const choice = group.choices.find((c) => c.id === selection[group.id])
    if (choice?.facts) facts = { ...facts, ...choice.facts }
  }
  return facts
}

const osName = (os: 'ios' | 'android') => (os === 'ios' ? 'iPhone' : 'Android')

export function checkBuild(subject: { name: string; facts: CompatFacts; product?: Product }, build: BuildItem[]): CompatResult {
  const issues: Issue[] = []
  const f = subject.facts
  const phones = build.filter((b) => b.facts.phone)
  const hubs = build.filter((b) => b.facts.hubs)
  const region = build.find((b) => b.facts.region)?.facts.region
  const option = (group: string) => subject.product?.options?.find((g) => g.id === group)

  // 1. Companion app: at least one phone in the setup must run it.
  if (f.app && phones.length) {
    const ok = phones.some((p) => f.app!.includes(p.facts.phone!.os))
    if (!ok) {
      const alt = option('network')?.choices.find((c) => c.facts?.app?.some((os) => phones.some((p) => p.facts.phone!.os === os)))
      issues.push({
        id: 'app',
        severity: 'bad',
        title: `No app for your ${phones.map((p) => p.name).join(' or ')}`,
        because: `${subject.name} needs its companion app, which is ${f.app.map(osName).join(' and ')}-only. Your setup has ${phones.map((p) => `${p.name} (${osName(p.facts.phone!.os)})`).join(', ')}.`,
        fix: alt ? { label: `Switch to ${alt.label}`, kind: 'select-option', optionGroup: 'network', choice: alt.id } : undefined,
      })
    }
  }

  // 2. Magnetic attach: the phone needs a Qi2 / MagSafe ring, or a case that adds one.
  if (f.magnetic && phones.length) {
    const caseInBuild = build.some((b) => b.facts.givesMagnets)
    const ok = phones.some((p) => p.facts.phone!.magnets) || caseInBuild
    if (!ok) {
      issues.push({
        id: 'magnets',
        severity: 'warn',
        title: `Won't snap onto your ${phones[0].name}`,
        because: `${subject.name} attaches with Qi2 magnets. ${phones[0].name} has Qi charging but no magnet ring, so it will slide off.`,
        fix: { label: 'Add Snap Case magnet ring · $25', kind: 'add-sku', sku: 'snap-case' },
      })
    }
  }

  // 3. Finder network: Find My needs an iPhone, Find Hub needs Android.
  if (f.tracker && phones.length) {
    const ok = phones.some((p) => p.facts.phone!.trackerNet === f.tracker)
    if (!ok) {
      const alt = option('network')?.choices.find((c) => phones.some((p) => p.facts.phone!.trackerNet === c.facts?.tracker))
      issues.push({
        id: 'tracker',
        severity: 'bad',
        title: `${f.tracker === 'find-my' ? 'Apple Find My' : 'Google Find Hub'} needs ${f.tracker === 'find-my' ? 'an iPhone' : 'an Android phone'}`,
        because: `This version joins ${f.tracker === 'find-my' ? "Apple's Find My" : "Google's Find Hub"} network, which ${phones.map((p) => p.name).join(' and ')} cannot see.`,
        fix: alt ? { label: `Switch to ${alt.label}`, kind: 'select-option', optionGroup: 'network', choice: alt.id } : undefined,
      })
    }
  }

  // 4. Smart home: the device must speak a protocol one of your hubs understands; Thread needs a border router.
  if (f.home && hubs.length) {
    const provided = new Set(hubs.flatMap((h) => h.facts.hubs!))
    const shared = f.home.filter((p) => provided.has(p))
    if (shared.length === 0) {
      issues.push({
        id: 'home',
        severity: 'warn',
        title: `Won't appear in ${hubs.map((h) => h.name.split(' (')[0]).join(' or ')}`,
        because: `${subject.name} works with ${f.home.map((p) => PROTO_LABEL[p]).join(', ')} but not Matter, so it stays in its own app rather than your home app.`,
      })
    }
    if (f.needsThread && !provided.has('thread')) {
      issues.push({
        id: 'thread',
        severity: 'warn',
        title: 'Needs a Thread border router',
        because: `${subject.name} talks Matter over Thread. ${hubs.map((h) => h.name).join(' and ')} has no Thread radio, so it cannot join your network.`,
        fix: { label: 'Add Nimbus Hub (Thread + Matter) · $69', kind: 'add-sku', sku: 'nimbus-hub' },
      })
    }
  }

  // 5. Plug and voltage: match the shopper's region, or include an adapter.
  if (region && f.plug && f.plug !== region) {
    const adapter = build.some((b) => b.facts.adapterFor === region)
    if (!adapter) {
      const choice = option('plug')?.choices.find((c) => c.facts?.plug === region)
      issues.push({
        id: 'plug',
        severity: 'warn',
        title: `Ships with a ${f.plug} plug`,
        because: `You are in ${REGION_LABEL[region]}. This configuration ships with a ${f.plug} plug (${REGION_LABEL[f.plug]}).`,
        fix: choice
          ? { label: `Switch to the ${region} plug`, kind: 'select-option', optionGroup: 'plug', choice: choice.id }
          : { label: 'Add travel plug adapter · $9', kind: 'add-sku', sku: 'plug-adapter' },
      })
    }
  }
  if (region && f.voltage === '110' && region !== 'US') {
    issues.push({ id: 'voltage', severity: 'bad', title: '110 V only', because: `${subject.name} is a 110 V device; ${REGION_LABEL[region]} mains would damage it. A plug adapter does not convert voltage.` })
  }

  // 6. Physical inputs: things in your setup that need to plug into this product.
  if (f.provides) {
    const provided = new Map<PortKind, number>()
    for (const p of f.provides) provided.set(p.kind, (provided.get(p.kind) ?? 0) + p.count)
    for (const item of build) {
      for (const req of item.facts.requires ?? []) {
        if (!req.anyOf.some((k) => (provided.get(k) ?? 0) > 0)) {
          issues.push({
            id: `port-${item.id}`,
            severity: 'bad',
            title: `${item.name} has nothing to plug into`,
            because: `${item.name} needs ${req.label}; ${subject.name} has ${f.provides.map((p) => PORT_LABEL[p.kind]).join(', ')}.`,
          })
        }
      }
    }
  }

  // 7. Charging power: the strongest charger you own vs what this draws while in use.
  const chargers = build.filter((b) => b.facts.pdOut)
  if (f.pdInMin && chargers.length) {
    const best = chargers.reduce((a, b) => ((b.facts.pdOut ?? 0) > (a.facts.pdOut ?? 0) ? b : a))
    if ((best.facts.pdOut ?? 0) < f.pdInMin) {
      issues.push({
        id: 'power',
        severity: 'warn',
        title: 'Battery drains while plugged in',
        because: `${best.name} supplies ${best.facts.pdOut} W; this configuration draws up to ${f.pdInMin} W at full brightness, so a long film will still run the battery down.`,
        fix: { label: 'Add Aether Cube 100 W · $59', kind: 'add-sku', sku: 'aether-cube-100' },
      })
    }
  }

  const status: Severity = issues.some((i) => i.severity === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok'
  const bad = issues.filter((i) => i.severity === 'bad').length
  const warn = issues.length - bad
  const summary =
    status === 'ok'
      ? `Works with all ${build.length} items in your setup`
      : status === 'bad'
        ? `${bad} blocker${bad > 1 ? 's' : ''}${warn ? ` · ${warn} to check` : ''}`
        : `${warn} thing${warn > 1 ? 's' : ''} to check`
  return { status, issues, checked: build.length, summary }
}
