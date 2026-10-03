import { describe, expect, it, vi } from 'vitest'

describe('store persistence', () => {
  it('persist survives a throwing storage', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
    const { useStore } = await import('./store')
    expect(useStore.getState().cart).toEqual([])
    useStore.getState().addRecentSearch('ring')
    useStore.getState().addRecentSearch('ring')
    useStore.getState().addRecentSearch('mask')
    expect(useStore.getState().recentSearches).toEqual(['mask', 'ring'])
  })
  it('signIn creates an account and clearData wipes it', async () => {
    const { useStore } = await import('./store')
    useStore.getState().signIn('nick@example.com')
    expect(useStore.getState().account?.email).toBe('nick@example.com')
    useStore.getState().clearData()
    expect(useStore.getState().account).toBeNull()
  })
  it('go sets the route and the region follows the gear', async () => {
    const { useStore } = await import('./store')
    useStore.getState().go({ name: 'setup' })
    expect(useStore.getState().route).toEqual({ name: 'setup' })
    expect(useStore.getState().region()).toBe('AU')
    useStore.getState().setRegion('UK')
    expect(useStore.getState().region()).toBe('UK')
    expect(useStore.getState().gear.filter((g) => g.kind === 'region')).toHaveLength(1)
  })
})
