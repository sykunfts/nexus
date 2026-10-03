/*
  The shop's policies, one component each, in the guides' reading style. Every page is dated and
  marked as a draft pending professional review; the business details come from one constant so
  the day the company and domain exist is a one-line change.
*/
import type { ComponentType } from 'react'
import { Terms } from './terms'
import { Privacy } from './privacy'
import { ShippingReturns } from './shipping-returns'
import { Contact } from './contact'

export { BUSINESS, DRAFT_NOTICE, RETURNS_LINE } from './business'

export interface Policy { slug: string; title: string; summary: string; updated: string; Component: ComponentType }

export const POLICIES: Policy[] = [
  { slug: 'terms', title: 'Terms of sale', summary: 'Who you buy from, what you pay, when an order is accepted, and the rights you keep.', updated: '2026-10-03', Component: Terms },
  { slug: 'privacy', title: 'Privacy', summary: 'What we collect to fulfil an order, where it is held, and how to have it deleted.', updated: '2026-10-03', Component: Privacy },
  { slug: 'shipping-returns', title: 'Shipping and returns', summary: 'Delivery windows by route and destination, the returns rule, and how a faulty-goods claim works.', updated: '2026-10-03', Component: ShippingReturns },
  { slug: 'contact', title: 'Contact', summary: 'How to reach us about an order, a return or your data.', updated: '2026-10-03', Component: Contact },
]

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug)
