/* Client state. In Next.js this mirrors a server-side cart; mutations are Server Actions. */
import { create } from 'zustand'
import { byId, gear, Product } from './data'
import { Currency, detectCurrency, ShipMethod } from './currency'

export interface Line {
  key: string
  productId: string
  variantId: string
  selection: Record<string, string>
  qty: number
  unitPrice: number
}

export interface Toast { id: number; title: string; body?: string; action?: { label: string; onClick: () => void } }

export type View = { name: 'home' } | { name: 'pdp'; id: string }

interface State {
  view: View
  currency: Currency
  shipMethod: ShipMethod
  cart: Line[]
  cartOpen: boolean
  lastAdded: string | null
  quickViewId: string | null
  advisorOpen: boolean
  searchOpen: boolean
  gearOn: Record<string, boolean>
  compare: string[]
  toasts: Toast[]

  go: (view: View) => void
  setCurrency: (c: Currency) => void
  setShipMethod: (m: ShipMethod) => void
  add: (product: Product, variantId: string, selection?: Record<string, string>, qty?: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  openCart: (open: boolean) => void
  setQuickView: (id: string | null) => void
  setAdvisor: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  toggleGear: (id: string) => void
  toggleCompare: (id: string) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

export const priceFor = (product: Product, selection: Record<string, string>, variantId?: string) =>
  product.price +
  (product.variants.find((v) => v.id === variantId)?.delta ?? 0) +
  (product.options ?? []).reduce((sum, g) => sum + (g.choices.find((c) => c.id === selection[g.id])?.delta ?? 0), 0)

export const defaultSelection = (product: Product) =>
  Object.fromEntries((product.options ?? []).map((g) => [g.id, g.choices[0].id]))

let toastId = 0

export const useStore = create<State>((set, get) => ({
  view: { name: 'home' },
  currency: detectCurrency(),
  shipMethod: 'standard',
  cart: [],
  cartOpen: false,
  lastAdded: null,
  quickViewId: null,
  advisorOpen: false,
  searchOpen: false,
  gearOn: Object.fromEntries(gear.map((g) => [g.id, g.defaultOn])),
  compare: [],
  toasts: [],

  go: (view) => {
    set({ view, quickViewId: null, searchOpen: false })
    try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) } catch { /* noop */ }
  },
  setCurrency: (currency) => set({ currency }),
  setShipMethod: (shipMethod) => set({ shipMethod }),

  add: (product, variantId, selection = defaultSelection(product), qty = 1) => {
    const key = `${product.id}:${variantId}:${Object.values(selection).join('-')}`
    const unitPrice = priceFor(product, selection, variantId)
    set((s) => {
      const existing = s.cart.find((l) => l.key === key)
      const cart = existing
        ? s.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        : [...s.cart, { key, productId: product.id, variantId, selection, qty, unitPrice }]
      return { cart, lastAdded: key, cartOpen: true }
    })
    window.setTimeout(() => set((s) => (s.lastAdded === key ? { lastAdded: null } : {})), 1400)
  },
  setQty: (key, qty) =>
    set((s) => ({ cart: qty <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key ? { ...l, qty } : l)) })),
  remove: (key) => {
    const line = get().cart.find((l) => l.key === key)
    set((s) => ({ cart: s.cart.filter((l) => l.key !== key) }))
    if (line) {
      get().toast({
        title: `Removed ${byId(line.productId).name}`,
        action: { label: 'Undo', onClick: () => set((s) => ({ cart: [...s.cart, line] })) },
      })
    }
  },
  openCart: (cartOpen) => set({ cartOpen }),
  setQuickView: (quickViewId) => set({ quickViewId }),
  setAdvisor: (advisorOpen) => set({ advisorOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toggleGear: (id) => set((s) => ({ gearOn: { ...s.gearOn, [id]: !s.gearOn[id] } })),
  toggleCompare: (id) =>
    set((s) => ({ compare: s.compare.includes(id) ? s.compare.filter((x) => x !== id) : [...s.compare, id].slice(-4) })),
  toast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    window.setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const cartCount = (cart: Line[]) => cart.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (cart: Line[]) => cart.reduce((n, l) => n + l.qty * l.unitPrice, 0)
