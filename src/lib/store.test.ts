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
    useStore.getState().clearData()
    expect(useStore.getState().storageBlocked).toBe(true)   // clearing data does not unblock the browser's storage
  })
  it('signIn creates an account and clearData wipes it', async () => {
    const { useStore } = await import('./store')
    useStore.getState().signIn('nick@example.com')
    expect(useStore.getState().account?.email).toBe('nick@example.com')
    useStore.getState().clearData()
    expect(useStore.getState().account).toBeNull()
  })
  it('signIn normalises the email and keeps the account when it is the same person', async () => {
    const { useStore } = await import('./store')
    useStore.getState().signIn('nick@example.com')
    useStore.getState().addAddress({ name: 'Nick', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU', isDefault: true })
    const created = useStore.getState().account!.createdAt
    useStore.getState().signIn('  Nick@Example.com ')
    expect(useStore.getState().account?.email).toBe('nick@example.com')
    expect(useStore.getState().account?.createdAt).toBe(created)
    expect(useStore.getState().account?.addresses).toHaveLength(1)
    // a different email is a different person: fresh account, no addresses carried over
    useStore.getState().signIn('someone@else.com')
    expect(useStore.getState().account?.addresses).toEqual([])
    useStore.getState().clearData()
  })
  it('clearData returns to the home page as well as wiping data', async () => {
    const { useStore } = await import('./store')
    useStore.getState().go({ name: 'account' })
    useStore.getState().clearData()
    expect(useStore.getState().route).toEqual({ name: 'home' })
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
