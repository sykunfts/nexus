/* Contact: one address, and the company line once it exists. */
import { H2, Note, P } from '../../components/guides/Prose'
import { BUSINESS } from './business'
import { PolicyLink } from './PolicyLink'

export function Contact() {
  return (
    <>
      <H2>Email</H2>
      <P>Write to {BUSINESS.contactEmail}. For anything about an order, include the order number (it starts with NX-) and the email you ordered with, so we can find it without asking twice. We answer within two business days, Sydney time.</P>

      <H2>Returns and faults</H2>
      <P>The steps, and who pays postage in each case, are on the <PolicyLink slug="shipping-returns">shipping and returns page</PolicyLink>. Start there; it saves a round of email.</P>

      <H2>The company</H2>
      <P>{BUSINESS.name}{BUSINESS.abn ? `, ABN ${BUSINESS.abn}` : ', ABN to be added once registered'}, {BUSINESS.state}, Australia.</P>

      <Note>Placeholders stay on this page until the company is registered and the domain exists; both lines come from one constant and change together.</Note>
    </>
  )
}
