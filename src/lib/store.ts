/*
  Client state. The route is the source of truth for navigation (the hash mirrors it); setup, cart,
  account, orders and recent searches persist in the browser under one versioned key. Nothing leaves
  the browser. In Next.js this mirrors a server-side cart; mutations are Server Actions.
*/
import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_GEAR, GearItem, Product, productById, Region, REGION_LABEL } from './data'
import { Currency, detectCurrency, ShipMethod } from './currency'
import { Route } from './routes'
import { Account, Address } from './account'
import { Order } from './orders'
import { COUNTRIES, Country, Zone } from './shipping'

export interface Line {
  key: string
  productId: string
  variantId: string
  selection: Record<string, string>
  qty: number
  unitPrice: number
}

export interface Toast { id: number; title: string; body?: string; action?: { label: string; onClick: () => void } }

interface State {
  route: Route
  currency: Currency
  shipMethod: ShipMethod
  cart: Line[]
  cartOpen: boolean
  lastAdded: string | null
  quickViewId: string | null
  advisorOpen: boolean
  searchOpen: boolean
  gear: GearItem[]
  gearOn: Record<string, boolean>
  compare: string[]
  toasts: Toast[]
  account: Account | null
  orders: Order[]
  recentSearches: string[]
  storageBlocked: boolean

  go: (route: Route) => void
  setCurrency: (c: Currency) => void
  setShipMethod: (m: ShipMethod) => void
  add: (product: Product, variantId: string, selection?: Record<string, string>, qty?: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clearCart: () => void
  openCart: (open: boolean) => void
  setQuickView: (id: string | null) => void
  setAdvisor: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  toggleGear: (id: string) => void
  addGear: (item: GearItem) => void
  removeGear: (id: string) => void
  setRegion: (r: Region) => void
  region: () => Region
  toggleCompare: (id: string) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  signIn: (email: string) => void
  signOut: () => void
  clearData: () => void
  addAddress: (a: Omit<Address, 'id'>) => Address
  updateAddress: (a: Address) => void
  removeAddress: (id: string) => void
  addOrder: (o: Order) => void
  addRecentSearch: (q: string) => void
}

export const priceFor = (product: Product, selection: Record<string, string>, variantId?: string) =>
  product.price +
  (product.variants.find((v) => v.id === variantId)?.delta ?? 0) +
  (product.options ?? []).reduce((sum, g) => sum + (g.choices.find((c) => c.id === selection[g.id])?.delta ?? 0), 0)

export const defaultSelection = (product: Product) =>
  Object.fromEntries((product.options ?? []).map((g) => [g.id, g.choices[0].id]))

export const regionGear = (r: Region): GearItem => ({ id: 'g-region', kind: 'region', name: REGION_LABEL[r].replace(/ \(.*$/, '') + ', ' + REGION_LABEL[r].match(/\((.*)\)/)![1], detail: 'Plug and voltage check', defaultOn: true, facts: { region: r } })

/* localStorage can be absent, blocked or throwing (private windows, sandboxed frames, cleared data). */
let storageBlocked = false
const memory = new Map<string, string>()
const safeStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k) } catch { storageBlocked = true; return memory.get(k) ?? null } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { storageBlocked = true; memory.set(k, v) } },
  removeItem: (k: string) => { try { localStorage.removeItem(k) } catch { storageBlocked = true; memory.delete(k) } },
}

let toastId = 0
const uid = () => Math.random().toString(36).slice(2, 10)

const initial = () => ({
  route: { name: 'home' } as Route,
  currency: detectCurrency(),
  shipMethod: 'standard' as ShipMethod,
  cart: [] as Line[],
  cartOpen: false,
  lastAdded: null as string | null,
  quickViewId: null as string | null,
  advisorOpen: false,
  searchOpen: false,
  gear: DEFAULT_GEAR,
  gearOn: Object.fromEntries(DEFAULT_GEAR.map((g) => [g.id, g.defaultOn])),
  compare: [] as string[],
  toasts: [] as Toast[],
  account: null as Account | null,
  orders: [] as Order[],
  recentSearches: [] as string[],
  storageBlocked: false,
})

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),

      go: (route) => {
        const prev = get().route
        set({ route, quickViewId: null, searchOpen: false })
        // a filter or sort change on the same collection or search keeps the scroll position
        const samePage = prev.name === route.name && ((route.name === 'collection' && prev.name === 'collection' && prev.slug === route.slug) || (route.name === 'search' && prev.name === 'search' && prev.q === route.q))
        if (!samePage) { try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) } catch { /* noop */ } }
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
        try { window.setTimeout(() => set((s) => (s.lastAdded === key ? { lastAdded: null } : {})), 1400) } catch { /* no window */ }
      },
      setQty: (key, qty) =>
        set((s) => ({ cart: qty <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key ? { ...l, qty } : l)) })),
      remove: (key) => {
        const line = get().cart.find((l) => l.key === key)
        set((s) => ({ cart: s.cart.filter((l) => l.key !== key) }))
        if (line) {
          get().toast({
            title: `Removed ${productById(line.productId)?.name ?? 'item'}`,
            action: { label: 'Undo', onClick: () => set((s) => ({ cart: [...s.cart, line] })) },
          })
        }
      },
      clearCart: () => set({ cart: [] }),
      openCart: (cartOpen) => set({ cartOpen }),
      setQuickView: (quickViewId) => set({ quickViewId }),
      setAdvisor: (advisorOpen) => set({ advisorOpen }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),

      toggleGear: (id) => set((s) => ({ gearOn: { ...s.gearOn, [id]: !s.gearOn[id] } })),
      addGear: (item) => set((s) => ({ gear: [...s.gear.filter((g) => g.id !== item.id), item], gearOn: { ...s.gearOn, [item.id]: true } })),
      removeGear: (id) => set((s) => { const gearOn = { ...s.gearOn }; delete gearOn[id]; return { gear: s.gear.filter((g) => g.id !== id), gearOn } }),
      setRegion: (r) => set((s) => ({ gear: [...s.gear.filter((g) => g.kind !== 'region'), regionGear(r)], gearOn: { ...s.gearOn, 'g-region': true } })),
      region: () => get().gear.find((g) => g.kind === 'region')?.facts.region ?? 'AU',

      toggleCompare: (id) =>
        set((s) => ({ compare: s.compare.includes(id) ? s.compare.filter((x) => x !== id) : [...s.compare, id].slice(-4) })),
      toast: (t) => {
        const id = ++toastId
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
        try { window.setTimeout(() => get().dismissToast(id), 5000) } catch { /* no window */ }
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      signIn: (email) => set((s) => ({ account: s.account?.email === email ? s.account : { email: email.trim().toLowerCase(), createdAt: new Date().toISOString(), addresses: s.account?.addresses ?? [] } })),
      signOut: () => set({ account: null }),
      clearData: () => { set({ ...initial(), currency: get().currency }); try { safeStorage.removeItem('nexus.v1') } catch { /* noop */ } },
      addAddress: (a) => {
        const address: Address = { ...a, id: uid() }
        set((s) => {
          const acct = s.account ?? { email: '', createdAt: new Date().toISOString(), addresses: [] }
          const addresses = address.isDefault ? acct.addresses.map((x) => ({ ...x, isDefault: false })) : acct.addresses
          return { account: { ...acct, addresses: [...addresses, address] } }
        })
        return address
      },
      updateAddress: (a) => set((s) => s.account ? { account: { ...s.account, addresses: s.account.addresses.map((x) => (x.id === a.id ? a : a.isDefault ? { ...x, isDefault: false } : x)) } } : {}),
      removeAddress: (id) => set((s) => s.account ? { account: { ...s.account, addresses: s.account.addresses.filter((x) => x.id !== id) } } : {}),
      addOrder: (o) => set((s) => ({ orders: [o, ...s.orders] })),
      addRecentSearch: (q) => {
        const t = q.trim()
        if (!t) return
        set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5) }))
      },
    }),
    {
      name: 'nexus.v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ gear: s.gear, gearOn: s.gearOn, cart: s.cart, account: s.account, orders: s.orders, recentSearches: s.recentSearches, currency: s.currency, compare: s.compare }),
      migrate: (persisted) => persisted as State,
      // a persisted cart or compare list can name a product the catalogue no longer carries; drop those rather than crash
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return {
          ...current,
          ...p,
          cart: (p.cart ?? []).filter((l) => !!productById(l.productId)),
          compare: (p.compare ?? []).filter((id) => !!productById(id)),
          gear: p.gear?.length ? p.gear : current.gear,
          gearOn: p.gearOn ?? current.gearOn,
        }
      },
      onRehydrateStorage: () => (state) => { if (state && storageBlocked) state.storageBlocked = true },
    },
  ),
)

/** The shopper's shipping zone, from the region in My setup. */
export const useZone = (): Zone => useStore((s) => {
  const r = s.gear.find((g) => g.kind === 'region')?.facts.region ?? 'AU'
  return COUNTRIES.find((c) => c.region === r)?.zone ?? 'AU'
})
export const useRegion = (): Region => useStore((s) => s.gear.find((g) => g.kind === 'region')?.facts.region ?? 'AU')
/** The country the cart prices tax and shipping for: the default saved address, else the region's own country. */
export const deliveryCountry = (s: Pick<State, 'account' | 'gear'>): Country => {
  const saved = s.account?.addresses.find((a) => a.isDefault) ?? s.account?.addresses[0]
  if (saved) return saved.country
  const r = s.gear.find((g) => g.kind === 'region')?.facts.region ?? 'AU'
  return COUNTRIES.find((c) => c.region === r)?.code ?? 'AU'
}
export const useDeliveryCountry = (): Country => useStore(deliveryCountry)
/** The setup items that are switched on, as the compat engine wants them. Memoised so selectors stay stable. */
export const useSetup = () => {
  const gear = useStore((s) => s.gear)
  const gearOn = useStore((s) => s.gearOn)
  return useMemo(() => gear.filter((g) => gearOn[g.id]).map((g) => ({ id: g.id, name: g.name, facts: g.facts })), [gear, gearOn])
}

export const cartCount = (cart: Line[]) => cart.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (cart: Line[]) => cart.reduce((n, l) => n + l.qty * l.unitPrice, 0)
