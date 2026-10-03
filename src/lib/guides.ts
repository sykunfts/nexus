/* Guide registry: six guides written for real, each with one live element that reads the catalogue. */
import type { ComponentType } from 'react'
import { WorksWithMyPhone } from '../components/guides/WorksWithMyPhone'
import { MovieNight } from '../components/guides/MovieNight'
import { DoINeedAHub } from '../components/guides/DoINeedAHub'
import { Qi2VsMagSafe } from '../components/guides/Qi2VsMagSafe'
import { RingSizing } from '../components/guides/RingSizing'
import { RedVsNearInfrared } from '../components/guides/RedVsNearInfrared'

export type GuideSlug = 'works-with-my-phone' | 'movie-night' | 'do-i-need-a-hub' | 'qi2-vs-magsafe' | 'ring-sizing' | 'red-vs-near-infrared'

export interface Guide { slug: GuideSlug; title: string; summary: string; section: string; minutes: number; Component: ComponentType }

export const GUIDES: Guide[] = [
  { slug: 'works-with-my-phone', title: 'Does it work with my phone?', summary: 'The seven checks every product page runs against your setup, and a live demo.', section: 'All', minutes: 4, Component: WorksWithMyPhone },
  { slug: 'movie-night', title: 'Movie night, checked as a set', summary: 'How far to sit, how big the picture gets, and the kit that goes together.', section: 'Cinema', minutes: 5, Component: MovieNight },
  { slug: 'do-i-need-a-hub', title: 'Do I need a hub?', summary: 'Matter, Thread and border routers, with your own hubs checked against the catalogue.', section: 'Smart home', minutes: 5, Component: DoINeedAHub },
  { slug: 'qi2-vs-magsafe', title: 'Qi2 vs MagSafe', summary: 'Why a Pixel 9 slides off a magnetic bank and what fixes it for a few dollars.', section: 'Power', minutes: 3, Component: Qi2VsMagSafe },
  { slug: 'ring-sizing', title: 'Ring sizing', summary: 'Why the kit ships first, what the ranges are, and which finger.', section: 'Wearables', minutes: 3, Component: RingSizing },
  { slug: 'red-vs-near-infrared', title: 'Red vs near-infrared light', summary: 'What the two wavelengths in an LED mask are for, and what is claim rather than evidence.', section: 'Health', minutes: 4, Component: RedVsNearInfrared },
]

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug)
