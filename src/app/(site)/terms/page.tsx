import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, LegalSection } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using 13C, a Cebu car-rental marketplace and software platform. 13C is not a rental company: vehicles are rented by independent rental businesses.",
};

const TOC = [
  { id: "agreement", title: "About these Terms" },
  { id: "what-13c-is", title: "What 13C is (and is not)" },
  { id: "accounts", title: "Accounts and eligibility" },
  { id: "renters", title: "Renter obligations" },
  { id: "businesses", title: "Rental business obligations" },
  { id: "bookings", title: "Bookings and rental agreements" },
  { id: "payments", title: "Payments" },
  { id: "e-signatures", title: "Electronic signatures and records" },
  { id: "subscriptions", title: "Business plans and fees" },
  { id: "reviews", title: "Reviews and reports" },
  { id: "prohibited", title: "Prohibited conduct" },
  { id: "content", title: "Content and intellectual property" },
  { id: "suspension", title: "Suspension and termination" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnity", title: "Indemnity" },
  { id: "law", title: "Governing law and disputes" },
  { id: "changes", title: "Changes to these Terms" },
  { id: "contact", title: "Contact" },
];
const sec = (id: string) => ({ id, n: TOC.findIndex((t) => t.id === id) + 1, title: TOC.find((t) => t.id === id)?.title ?? id });

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="October 3, 2026"
      toc={TOC}
      intro={
        <>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the 13C website, marketplace, business storefronts, business dashboard and related
            services (the &ldquo;Platform&rdquo;), operated by 13C (&ldquo;13C&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          </p>
          <p className="mt-3 rounded-2xl bg-canvas p-4">
            <strong className="text-navy-900">In short:</strong> 13C is a technology platform. We are <strong className="text-navy-900">not</strong> a car rental
            company and we do not own, operate or insure any vehicle. Every rental is a contract directly between you and an independent rental business.
          </p>
        </>
      }
    >
      <LegalSection {...sec("agreement")}>
        <p>
          By creating an account or using the Platform, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you use the
          Platform for a rental business, you confirm that you are authorized to bind that business, and &ldquo;you&rdquo; includes the business.
          If you do not agree, do not use the Platform.
        </p>
      </LegalSection>

      <LegalSection {...sec("what-13c-is")}>
        <p>13C provides two things:</p>
        <ul>
          <li>a <strong>marketplace</strong> where renters can discover vehicles and contact rental businesses in Cebu; and</li>
          <li><strong>software (SaaS)</strong> that rental businesses use to run a storefront, manage vehicles, bookings, customers and rental agreements.</li>
        </ul>
        <p>13C is <strong>not</strong>:</p>
        <ul>
          <li>a rental provider, lessor, vehicle owner or operator, common carrier, transport network company or travel agency;</li>
          <li>a party to any rental agreement between a renter and a rental business, or an agent of either of them; or</li>
          <li>an insurer, guarantor or escrow agent.</li>
        </ul>
        <p>
          Rental businesses on 13C (&ldquo;Rental Businesses&rdquo;) are independent providers. Each one alone is responsible for its vehicles, their
          registration, roadworthiness, maintenance and insurance, its drivers (where a driver is provided), its prices and policies, and the rental
          terms it offers and enforces.
        </p>
      </LegalSection>

      <LegalSection {...sec("accounts")}>
        <ul>
          <li>You must be at least 18 years old and able to enter into binding contracts under Philippine law.</li>
          <li>Give accurate, current and complete information, and keep it up to date.</li>
          <li>Keep your password confidential. You are responsible for activity on your account. Tell us immediately at <a href="mailto:support@air-rally.com">support@air-rally.com</a> if you suspect unauthorized use.</li>
          <li>Accounts are personal. Do not share them or create accounts for other people without their authority.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("renters")}>
        <p>If you rent a vehicle through the Platform, you agree to:</p>
        <ul>
          <li>hold a valid driver&apos;s license for the vehicle you rent (for self-drive rentals), and provide genuine identification and verification documents that belong to you;</li>
          <li>read the vehicle listing, the Rental Business&apos;s policies and the rental agreement before you sign;</li>
          <li>use the vehicle lawfully, comply with Philippine traffic laws and the rental agreement, and allow only authorized drivers to drive;</li>
          <li>inspect the vehicle at pickup, return it on time and in the agreed condition, and pay the Rental Business the amounts you agreed to; and</li>
          <li>raise any complaint about a vehicle or rental with the Rental Business first. We may help facilitate communication, but we are not responsible for resolving rental disputes.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("businesses")}>
        <p>If you list on 13C as a Rental Business, you agree to:</p>
        <ul>
          <li>
            <strong>Verification:</strong> submit truthful business registration details and documents (for example DTI, SEC or CDA registration and local
            business permits) and an authorized representative. 13C may approve, request changes to, reject or suspend a business at its discretion.
            Verification is a limited check of documents provided to us. It is not a guarantee of a business&apos;s quality, solvency or legal compliance.
          </li>
          <li>
            <strong>Accurate listings:</strong> list only vehicles you own or are authorized to rent out, with accurate photos, specifications, prices,
            fees, deposits, availability and policies, and keep them up to date.
          </li>
          <li>
            <strong>Legal compliance:</strong> hold and maintain every license, permit, registration and insurance (including compulsory third-party
            liability insurance) your business and vehicles require, and comply with consumer protection, tax and data privacy laws.
          </li>
          <li><strong>Honoring bookings:</strong> provide the vehicle and services you confirm, and handle deposits, refunds and damage claims fairly and lawfully.</li>
          <li>
            <strong>Renter data:</strong> use renter information received through 13C only to evaluate, perform and document the rental, keep it secure,
            and comply with the Data Privacy Act of 2012 as an independent personal information controller.
          </li>
          <li><strong>Your team:</strong> make sure staff you invite follow these Terms. You are responsible for their actions on your account.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("bookings")}>
        <p>
          A booking becomes a confirmed rental only after the Rental Business approves it and the rental agreement is signed as shown in the booking.
          Requests, quotes and messages are not binding until then.
        </p>
        <p>
          Rental agreements are generated from a standard template, filled in with the booking details and the Rental Business&apos;s own policies.
          The rental agreement is a contract <strong>between the renter and the Rental Business only</strong>. The Rental Business is responsible
          for the terms it offers. 13C provides the template as a convenience and does not give legal advice to either party. If a booking changes after
          a version is sent, a new version is created and must be signed again. Signed versions are never edited.
        </p>
        <p>Cancellations, no-shows, late returns, fuel, mileage, deposits and damage are governed by the rental agreement and the Rental Business&apos;s policies.</p>
      </LegalSection>

      <LegalSection {...sec("payments")}>
        <p>
          In this version of the Platform, <strong>13C does not process, collect, hold or escrow any rental payment</strong>. Renters pay the Rental Business
          directly using the methods it lists, such as cash, GCash, Maya or bank transfer. Rental Businesses may record payments on the Platform for
          tracking only. Any payment, deposit, refund or chargeback issue is between the renter and the Rental Business.
        </p>
        <p>13C will never ask you for your card number, online-banking password or e-wallet PIN. Report anyone who does.</p>
      </LegalSection>

      <LegalSection {...sec("e-signatures")}>
        <p>
          You agree to transact electronically. Under the <strong>Electronic Commerce Act of 2000 (Republic Act No. 8792)</strong> and its implementing rules,
          electronic documents and electronic signatures have the same legal effect as paper documents and handwritten signatures when the
          requirements of the law are met.
        </p>
        <p>
          When you sign on the Platform, you adopt the typed or drawn signature as your own and intend to be bound. To prove who signed what and when,
          we record the signer&apos;s name and signature, the date and time, IP address and device/browser information, and a cryptographic hash of the exact
          document version signed. We keep these records as described in our <Link href="/privacy">Privacy Policy</Link>. Both parties can download a PDF copy
          of the signed agreement.
        </p>
      </LegalSection>

      <LegalSection {...sec("subscriptions")}>
        <p>
          Rental Businesses may use a Free plan or a paid plan (Pro or Business) with the features and vehicle limits described on our{" "}
          <Link href="/for-business#pricing">pricing page</Link>. Paid plans are prepaid one month at a time through our payment processor, PayMongo,
          and don&apos;t renew automatically. Paying for your current plan (or during your trial) adds a month after the current period ends. Switching between
          paid plans starts right away, and unused days carry over at the new plan&apos;s price. If a plan
          isn&apos;t renewed, your store is hidden from customers until you pay again. Fees are
          exclusive of applicable taxes unless stated otherwise. We will give at least thirty (30) days&apos; notice of any price change. If a plan is downgraded
          or not renewed, existing listings remain, but you cannot add vehicles beyond the new plan&apos;s limit.
        </p>
      </LegalSection>

      <LegalSection {...sec("reviews")}>
        <p>
          Renters may review a Rental Business after a completed rental. Reviews must reflect your genuine experience, be relevant and lawful, and
          must not contain personal data of others, offensive or discriminatory language, or false statements of fact. Rental Businesses may respond
          publicly and must not offer incentives for positive reviews or pressure renters to change them.
        </p>
        <p>
          We do not edit reviews to change their meaning, but we may hide reviews that break these Terms. Anyone can report a listing, business,
          review or user. We review reports and may act on them, but we are not obliged to monitor all content.
        </p>
      </LegalSection>

      <LegalSection {...sec("prohibited")}>
        <p>You must not:</p>
        <ul>
          <li>provide false information or documents, impersonate anyone, or use another person&apos;s license or ID;</li>
          <li>list vehicles you are not authorized to rent out, or post misleading prices, photos or availability;</li>
          <li>use the Platform for fraud, money laundering, illegal transport or any unlawful purpose;</li>
          <li>harass, threaten or discriminate against other users, or send spam;</li>
          <li>copy, scrape or harvest data from the Platform, or use other users&apos; personal data outside the rental it was shared for;</li>
          <li>interfere with or try to bypass the Platform&apos;s security, verification or access controls, or upload malicious code; or</li>
          <li>post content that infringes others&apos; rights or is obscene, defamatory or otherwise unlawful.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("content")}>
        <p>
          You keep ownership of content you upload, such as vehicle photos, descriptions and logos. You grant 13C a non-exclusive, royalty-free,
          worldwide license to host, display, adapt (for example, resize) and use that content to operate and promote the Platform while it is on the
          Platform. You confirm you have the rights to grant this license.
        </p>
        <p>The 13C name, logo, software and Platform design belong to 13C and may not be used without our written permission.</p>
      </LegalSection>

      <LegalSection {...sec("suspension")}>
        <p>
          We may suspend or close an account, unpublish a store or listing, or hide content if we reasonably believe these Terms or the law have been
          broken, to protect users or the Platform, or when required by law. Where appropriate, we will tell you why and give you a chance to respond.
          You may stop using the Platform at any time and request account deletion as described in the Privacy Policy. Bookings already confirmed
          remain governed by their rental agreements.
        </p>
      </LegalSection>

      <LegalSection {...sec("disclaimers")}>
        <p>
          The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent permitted by law, 13C makes no warranty about the
          vehicles, services, conduct, licenses or insurance of any Rental Business or renter, or that the Platform will be uninterrupted or error-free.
          Listings and policies are provided by Rental Businesses and are their responsibility.
        </p>
      </LegalSection>

      <LegalSection {...sec("liability")}>
        <p>To the fullest extent permitted by Philippine law:</p>
        <ul>
          <li>
            13C is not liable for loss, damage, injury or death arising from a rental or from the use, condition or operation of any vehicle, or from
            the acts or omissions of Rental Businesses, their drivers or renters;
          </li>
          <li>13C is not liable for indirect, incidental, special or consequential damages, or for lost profits, revenue or data; and</li>
          <li>
            13C&apos;s total liability for any claim relating to the Platform is limited to the greater of the subscription fees you paid 13C in the twelve
            (12) months before the claim, or five thousand pesos (₱5,000).
          </li>
        </ul>
        <p>
          Nothing in these Terms excludes liability that cannot be excluded by law, including liability for fraud, bad faith or gross negligence, or
          your rights under the Consumer Act of the Philippines and the Data Privacy Act.
        </p>
      </LegalSection>

      <LegalSection {...sec("indemnity")}>
        <p>
          You agree to indemnify and hold 13C harmless from claims, losses and reasonable costs (including legal fees) arising from your breach of these
          Terms, your listings or content, your rentals, or your violation of law or of others&apos; rights.
        </p>
      </LegalSection>

      <LegalSection {...sec("law")}>
        <p>
          These Terms are governed by the laws of the <strong>Republic of the Philippines</strong>. Before going to court, the parties will try in good
          faith to settle any dispute amicably within thirty (30) days of written notice. Subject to any non-waivable rights you have as a consumer,
          disputes shall be brought exclusively before the proper courts of <strong>Cebu City</strong>, to the exclusion of all other venues.
        </p>
      </LegalSection>

      <LegalSection {...sec("changes")}>
        <p>
          We may update these Terms. We will post the new version here with a new &ldquo;Last updated&rdquo; date and notify you of material changes by email or in
          the app at least fifteen (15) days before they take effect. Continuing to use the Platform after that means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection {...sec("contact")}>
        <ul>
          <li>Support, questions about these Terms, and privacy requests: <a href="mailto:support@air-rally.com">support@air-rally.com</a></li>
        </ul>
      </LegalSection>
    </LegalDoc>
  );
}
