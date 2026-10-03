/* Terms of sale: plain, short, and honest about what is a placeholder. */
import { H2, Note, P } from '../../components/guides/Prose'
import { BUSINESS } from './business'
import { PolicyLink } from './PolicyLink'

export function Terms() {
  return (
    <>
      <H2>Who you are buying from</H2>
      <P>The seller is {BUSINESS.name}{BUSINESS.abn ? `, ABN ${BUSINESS.abn}` : ''}, trading as Nexus. Products marked "Supplier direct" are bought by us from the maker or a wholesale supplier in China and shipped to you from there; the contract of sale is still with us, not with the supplier.</P>

      <H2>Prices and payment</H2>
      <P>Prices are in Australian dollars and include GST where it applies. The price you pay is the one shown on the review step and again on Stripe's payment page; shipping is shown as its own line before you pay. Payment is taken by Stripe on their secure page. We never see or store card numbers.</P>

      <H2>When an order is accepted</H2>
      <P>Your order is accepted when Stripe confirms the payment and you reach the confirmation page. Until then nothing is charged and no order exists. If the office cannot place an accepted order with the supplier, we tell you by email within two business days and you choose between waiting and a full refund.</P>

      <H2>Delivery</H2>
      <P>Delivery windows are estimates from the carrier and the route, not promises. The windows we show, by route and destination, are on the <PolicyLink slug="shipping-returns">shipping and returns page</PolicyLink>. Every parcel is tracked and the tracking number is emailed when it ships.</P>

      <H2>Your rights are not reduced</H2>
      <P>Nothing here excludes, restricts or modifies the guarantees in the Australian Consumer Law. If a product is faulty, not as described or does not do what it should, you are entitled to a repair, replacement or refund under those guarantees whichever route it shipped by. Our change-of-mind policy sits on top of those rights, not in place of them.</P>

      <H2>Governing law</H2>
      <P>These terms are governed by the laws of {BUSINESS.state}, Australia, and any dispute is heard in its courts.</P>

      <Note>These terms are a draft written in plain language by the people who run the shop. They will be reviewed by a lawyer before the company is registered and the shop goes live.</Note>
    </>
  )
}
