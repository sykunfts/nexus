/* Privacy: what an order needs, where it goes, and how to get it removed. */
import { H2, Note, P } from '../../components/guides/Prose'
import { BUSINESS } from './business'

export function Privacy() {
  return (
    <>
      <H2>What we collect</H2>
      <P>To fulfil an order we collect your name, delivery address, email, phone number if you give one, and what you ordered. If you ask to be told when a product is stocked, we keep that email against that product and nothing else. We do not collect anything to show you advertising.</P>

      <H2>Where it is held</H2>
      <P>Order records live in Cloudflare KV in our own account, in Cloudflare's data centres. Payment details are held by Stripe, who process the card; we receive a payment reference and the amount, never the card number. For supplier-direct products the name, address and phone number are sent to CJdropshipping so the parcel can be addressed and the carrier can deliver it. Each of these holds your data under their own privacy policy.</P>

      <H2>In your browser</H2>
      <P>My setup, your cart, your recent searches and the orders you placed in this browser are kept in the browser's own storage so they survive a reload. They are not sent anywhere unless you place an order. "Clear this browser's data" on the account page removes them. We set no advertising or tracking cookies.</P>

      <H2>How long we keep it</H2>
      <P>Order records that back a tax invoice are kept for seven years, as Australian tax law requires. Stock-alert emails are deleted once the alert is sent or on request. Everything else goes when it is no longer needed to serve you.</P>

      <H2>Seeing, correcting or deleting your data</H2>
      <P>Email {BUSINESS.contactEmail} from the address you ordered with and we will send what we hold, correct it, or delete what the law does not require us to keep, within 30 days.</P>

      <Note>This policy is a draft in plain language, pending review against the Australian Privacy Principles before the shop goes live.</Note>
    </>
  )
}
