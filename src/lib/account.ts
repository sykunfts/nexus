/* Account and address types, shared by the store, validation and orders without importing the store. */
import type { Country } from './shipping'

export interface Address {
  id: string
  name: string
  line1: string
  line2?: string
  city: string
  region?: string      // state, province, county or prefecture, per country
  postcode: string
  country: Country
  phone?: string
  isDefault: boolean
}

export interface Account {
  email: string
  createdAt: string
  addresses: Address[]
}
