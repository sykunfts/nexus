/*
  The home page (v3): seven sections, each its own layout family.
  Hero on a bench slab, facts as big numbers, the movers band, a four-cell bento, the setup panel and its row,
  the Sydney ledger, and the guides split. Each section lives in ./home; this file only orders and spaces them.
*/
import { Hero } from './home/Hero'
import { Facts } from './home/Facts'
import { Movers } from './home/Movers'
import { Fastest } from './home/Fastest'
import { SetupRow } from './home/SetupRow'
import { Shelf } from './home/Shelf'
import { Guides } from './home/Guides'

const GAP = 'mt-14 lg:mt-[104px]'

export function Home() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <Hero />
      <Facts />
      <div className="mt-12 lg:mt-20"><Movers /></div>
      <div className={GAP}><Fastest /></div>
      <div className={GAP}><SetupRow /></div>
      <div className={GAP}><Shelf /></div>
      <div className={GAP}><Guides /></div>
    </div>
  )
}
