import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, LegalSection } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How 13C collects, uses, shares, protects and retains personal data under the Philippine Data Privacy Act of 2012 (RA 10173), and how to exercise your rights.",
};

const TOC = [
  { id: "who-we-are", title: "Who we are" },
  { id: "data-we-collect", title: "Personal data we collect" },
  { id: "purposes", title: "How we use your data" },
  { id: "legal-bases", title: "Legal bases for processing" },
  { id: "sharing", title: "Who we share data with" },
  { id: "payments", title: "Payments" },
  { id: "retention", title: "How long we keep data" },
  { id: "deletion", title: "Deleting your account" },
  { id: "rights", title: "Your rights as a data subject" },
  { id: "security", title: "How we protect your data" },
  { id: "cookies", title: "Cookies and similar technologies" },
  { id: "businesses", title: "Rental businesses' responsibilities" },
  { id: "minors", title: "Minors" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact our Data Protection Officer" },
];
const sec = (id: string) => ({ id, n: TOC.findIndex((t) => t.id === id) + 1, title: TOC.find((t) => t.id === id)?.title ?? id });

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="October 5, 2026"
      toc={TOC}
      intro={
        <>
          <p>
            13C is a technology marketplace and software platform that connects renters with independent car rental businesses in Cebu. We take the
            privacy of renters, rental business owners and their staff seriously, and we process personal data in accordance with the{" "}
            <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, its Implementing Rules and Regulations, and issuances of the
            National Privacy Commission (NPC).
          </p>
          <p className="mt-3">
            This policy explains what we collect, why, who can see it, how long we keep it, and how you can exercise your rights. It should be read
            together with our <Link href="/terms" className="font-medium text-electric hover:underline">Terms of Service</Link>.
          </p>
        </>
      }
    >
      <LegalSection {...sec("who-we-are")}>
        <p>
          13C (&ldquo;13C&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the 13C website, marketplace, business storefronts and business dashboard
          (together, the &ldquo;Platform&rdquo;). For personal data we collect to run the Platform, 13C is the <strong>personal information controller</strong>.
        </p>
        <p>
          Each rental business that lists on 13C is a separate, independent company. When you book or message a rental business, that business
          receives the personal data it needs for your rental and becomes a personal information controller for that data in its own right
          (see <a href="#businesses">section 12</a>).
        </p>
      </LegalSection>

      <LegalSection {...sec("data-we-collect")}>
        <h3>Account information</h3>
        <ul>
          <li>Your name, email address, mobile number, password (stored only as a secure hash by our authentication provider) and profile photo.</li>
          <li>Your consent records, such as when you accepted our Terms and this Privacy Policy, and your marketing preferences.</li>
        </ul>
        <h3>Renter verification (KYC)</h3>
        <ul>
          <li>Legal name, date of birth, home address and city.</li>
          <li>Driver&apos;s license number and expiry date.</li>
          <li>Images of the front and back of your driver&apos;s license and of a government-issued ID that you upload.</li>
        </ul>
        <p>
          License numbers and government-issued identifiers are <strong>sensitive personal information</strong> under the Data Privacy Act. We collect
          them only because rental businesses must confirm that a renter is legally allowed to drive and is who they say they are.
        </p>
        <h3>Bookings and rental agreements</h3>
        <ul>
          <li>Booking details: vehicle, dates, pickup and return locations, number of drivers, fees, deposit, payment method and payment status recorded by the business.</li>
          <li>Rental agreements generated for your booking, including every version, and the PDF of the signed agreement.</li>
          <li>
            Electronic signature records: the name you sign with, your typed or drawn signature, the <strong>IP address</strong> and device/browser
            information (user agent) used, the <strong>date and time</strong> of signing, and a cryptographic fingerprint (hash) of the exact document you signed.
          </li>
        </ul>
        <h3>Messages, reviews and reports</h3>
        <ul>
          <li>Messages you exchange with rental businesses through the Platform.</li>
          <li>Reviews and ratings you post after a completed rental, and businesses&apos; responses.</li>
          <li>Reports you submit about listings, businesses, reviews or users.</li>
        </ul>
        <h3>Rental business information</h3>
        <ul>
          <li>Business name, address, contact details, registration type and number, and the name and title of the authorized representative.</li>
          <li>Registration and permit documents submitted for verification, and the names and emails of team members you invite.</li>
          <li>Payment instructions you choose to show renters (for example, a GCash or bank account name and number).</li>
        </ul>
        <h3>Usage and device data</h3>
        <ul>
          <li>
            Basic technical data needed to run and secure the Platform, such as IP address, browser type, pages requested and error logs kept by our
            hosting providers.
          </li>
          <li>Store and vehicle page views, counted with a one-way hashed identifier so businesses see visit totals without learning who visited.</li>
          <li>Your favorites and notification history.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("purposes")}>
        <p>We use personal data only for the following purposes:</p>
        <ul>
          <li>To create and secure your account, sign you in and prevent fraud and abuse.</li>
          <li>To let you search vehicles, contact rental businesses, request and manage bookings, and receive notifications about them.</li>
          <li>To let rental businesses verify renters, prepare rental agreements, and manage their fleet, bookings and customers.</li>
          <li>To generate, send, sign, store and prove the integrity of electronic rental agreements.</li>
          <li>To verify rental businesses before their stores are published, and to keep listings accurate and safe.</li>
          <li>To publish reviews, handle reports, investigate misuse and enforce our Terms.</li>
          <li>To provide customer support and respond to your requests.</li>
          <li>To produce aggregated, de-identified statistics that help us and rental businesses improve their services.</li>
          <li>To comply with legal obligations and lawful orders, and to establish, exercise or defend legal claims.</li>
          <li>To send product updates or promotions, but only if you opted in. You can opt out at any time.</li>
        </ul>
        <p>We do not sell personal data, and we do not use it for automated decisions that produce legal effects on you.</p>
      </LegalSection>

      <LegalSection {...sec("legal-bases")}>
        <p>Depending on the purpose, we rely on one or more of the lawful criteria in Sections 12 and 13 of the Data Privacy Act:</p>
        <ul>
          <li><strong>Contract:</strong> processing needed to provide the Platform to you and to carry out bookings and rental agreements you enter into.</li>
          <li><strong>Consent:</strong> for example, consent you give when you register, upload verification documents or opt in to marketing. You may withdraw consent, but this does not affect processing already done, and some features (such as booking) may no longer be available.</li>
          <li><strong>Legal obligation:</strong> keeping records required by tax, commercial and other laws, and responding to lawful requests from authorities.</li>
          <li><strong>Legitimate interests:</strong> securing the Platform, preventing fraud, moderating content and improving our services, balanced against your rights and freedoms.</li>
          <li><strong>Legal claims:</strong> sensitive personal information and signature evidence may be processed where necessary to establish, exercise or defend legal claims, including disputes about a rental.</li>
        </ul>
      </LegalSection>

      <LegalSection {...sec("sharing")}>
        <h3>The rental business you deal with</h3>
        <p>
          We share your data only with the rental business you message or book with, and only what it needs. A business can see your name and contact
          details once you message it or request a booking, and your verification details (legal name, address, date of birth and license number) once
          you have a booking with it, because they go into the rental agreement. Your uploaded license/ID images are available to a business once you
          request a booking with it, so it can review your request, and only while that booking is pending or in progress. Other rental businesses cannot see your data.
        </p>
        <h3>Service providers (processors)</h3>
        <p>
          We use trusted providers that process data on our behalf under written agreements, including <strong>Supabase</strong> (database,
          authentication and private file storage), <strong>PayMongo</strong> (subscription payments by rental businesses; we never see or store full
          card or e-wallet details), cloud hosting and content-delivery providers, email delivery services, and <strong>Cloudflare Workers AI</strong>,
          which answers questions typed into 13C&apos;s assistant chats (on our pages, in the dashboard and on rental stores) and writes drafts when a business uses &ldquo;Write with AI&rdquo; in its store editor
          (13C doesn&apos;t save those chats, and Cloudflare doesn&apos;t use them or the drafts to train AI models). Some providers
          may store or process data outside the Philippines; where they do, we require safeguards that provide a comparable level of protection,
          as the Data Privacy Act requires.
        </p>
        <h3>Authorities and legal matters</h3>
        <p>
          We may disclose data when required by law, regulation, subpoena or court order, or when necessary to protect the rights, property or
          safety of users, rental businesses, the public or 13C.
        </p>
        <h3>Business transfers</h3>
        <p>If 13C is involved in a merger, acquisition or sale of assets, personal data may be transferred subject to this policy, and we will notify you.</p>
        <h3>Public information</h3>
        <p>Reviews you post appear publicly on the business&apos;s storefront with your first name and last initial. Business names, listings and storefront content are public by design.</p>
      </LegalSection>

      <LegalSection {...sec("payments")}>
        <p>
          In the current version of the Platform, <strong>13C does not process, hold or store payments</strong>, and we never ask for your card number,
          bank password or e-wallet PIN. You pay the rental business directly using the methods it lists (for example cash, GCash, Maya or bank transfer).
          A business may record on the Platform that a payment was made, along with an amount, method and reference number, so both of you can track it.
        </p>
      </LegalSection>

      <LegalSection {...sec("retention")}>
        <p>We keep personal data only for as long as necessary for the purposes above:</p>
        <ul>
          <li><strong>Account data:</strong> while your account is active, and until it is anonymized after a deletion request.</li>
          <li><strong>Verification details and license/ID images:</strong> until you remove them or your account is anonymized, whichever comes first.</li>
          <li>
            <strong>Booking, payment, contract and e-signature records:</strong> retained after the rental for the periods required or permitted by law,
            such as tax record-keeping requirements and the prescriptive periods for claims under written contracts (which can be up to ten years),
            so that renters and businesses can prove what was agreed.
          </li>
          <li><strong>Messages:</strong> for as long as the related conversation or booking record is kept.</li>
          <li><strong>Technical logs:</strong> for a limited period set by our hosting providers, typically measured in days or weeks.</li>
        </ul>
        <p>When data is no longer needed, we delete or anonymize it securely.</p>
      </LegalSection>

      <LegalSection {...sec("deletion")}>
        <p>You can ask us to delete your account at any time:</p>
        <ol>
          <li>Sign in and open <Link href="/account">Account</Link>.</li>
          <li>Under <strong>Privacy</strong>, choose <strong>Request account deletion</strong> and confirm.</li>
          <li>We review the request and process it within thirty (30) days. We may contact you to confirm your identity or to resolve an active rental first.</li>
        </ol>
        <p>
          When we process your request, we <strong>anonymize</strong> your account: your name is replaced, your email, phone number and profile photo are
          removed, your verification details and uploaded license/ID records are deleted, your favorites are deleted, and the account is closed.
        </p>
        <p>
          Records we must keep for legal reasons, such as completed bookings, payment entries and signed rental agreements with their signature
          evidence, are retained for the periods described above. A signed agreement is kept in the exact form it was signed, because changing it would
          destroy its value as evidence. Access to it remains limited to you, the rental business that is party to it, and authorized 13C personnel.
        </p>
      </LegalSection>

      <LegalSection {...sec("rights")}>
        <p>Under the Data Privacy Act, you have the right to:</p>
        <ul>
          <li><strong>Be informed</strong> that your personal data is being processed, and how. This policy is part of that.</li>
          <li><strong>Access</strong> your personal data and receive a copy of it.</li>
          <li><strong>Correct (rectify)</strong> inaccurate or incomplete data. You can update most details yourself in your account.</li>
          <li><strong>Erasure or blocking</strong> of data that is no longer necessary, unlawfully obtained or processed without a lawful basis.</li>
          <li><strong>Object</strong> to processing, including direct marketing and processing based on legitimate interests.</li>
          <li><strong>Data portability:</strong> obtain your data in a structured, commonly used electronic format.</li>
          <li><strong>Damages</strong> for harm caused by inaccurate, incomplete, outdated, false or unlawfully obtained or used personal data.</li>
          <li>
            <strong>Lodge a complaint</strong> with the National Privacy Commission (
            <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a>) if you believe your rights were violated.
          </li>
        </ul>
        <p>
          To exercise these rights, email <a href="mailto:privacy@13c.online">privacy@13c.online</a> from the email address on your account. We may need to verify
          your identity before acting, and we will respond within thirty (30) days. For data a rental business holds about you as a separate controller, you
          may also contact that business directly. We will help you reach it.
        </p>
      </LegalSection>

      <LegalSection {...sec("security")}>
        <p>We use organizational, physical and technical measures appropriate to the risks, including:</p>
        <ul>
          <li>Encryption of data in transit (HTTPS/TLS) and encryption at rest by our infrastructure providers.</li>
          <li>
            <strong>Private storage</strong> for license/ID images, business registration documents and contract PDFs. These files are never public. They are
            opened through <strong>signed links that expire after about a minute</strong>, and only for people allowed to see them.
          </li>
          <li>
            <strong>Row-level security</strong> in our database, so each account can read only the records it is a party to: renters see their own bookings
            and the businesses they deal with; staff see only their own business&apos;s data.
          </li>
          <li>Role-based access for business teams (owner, manager, staff), and administrator access limited to authorized 13C personnel.</li>
          <li>Audit logs of sensitive actions such as verification decisions, contract changes and account changes.</li>
          <li>Tamper evidence for contracts: each version is fingerprinted with a cryptographic hash, and signed versions cannot be edited.</li>
        </ul>
        <p>
          No system is perfectly secure. If a personal data breach occurs that is likely to put you at real risk of serious harm, we will notify the
          National Privacy Commission and affected individuals within the period required by law (currently 72 hours from knowledge of the breach).
        </p>
      </LegalSection>

      <LegalSection {...sec("cookies")}>
        <p>We use a small number of cookies and similar technologies that are needed for the Platform to work:</p>
        <ul>
          <li><strong>Authentication cookies</strong> that keep you signed in securely.</li>
          <li><strong>Preference cookies,</strong> for example to remember which business you are managing in the dashboard.</li>
        </ul>
        <p>
          We do not currently use third-party advertising or cross-site tracking cookies. Page-view statistics use a one-way hashed identifier rather
          than a tracking cookie. If we introduce analytics or advertising cookies, we will update this policy and ask for consent where required.
          You can block cookies in your browser, but you will not be able to sign in without the essential ones.
        </p>
      </LegalSection>

      <LegalSection {...sec("businesses")}>
        <p>
          Rental businesses that receive renter data through 13C are independent personal information controllers. They must use it only to evaluate,
          perform and document the rental, protect it with appropriate safeguards, respect renters&apos; rights, and not download, copy or reuse it for
          unrelated purposes. Businesses are responsible for any personal data they collect outside the Platform, such as at vehicle pickup.
        </p>
      </LegalSection>

      <LegalSection {...sec("minors")}>
        <p>
          The Platform is intended for people who are at least 18 years old. Renters must hold a valid driver&apos;s license. We do not knowingly collect personal
          data from minors. If you believe a minor has given us personal data, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection {...sec("changes")}>
        <p>
          We may update this policy as the Platform or the law changes. We will post the new version here with a new &ldquo;Last updated&rdquo; date and, for
          material changes, notify you by email or in the app before they take effect.
        </p>
      </LegalSection>

      <LegalSection {...sec("contact")}>
        <p>For privacy questions, requests or complaints, contact our Data Protection Officer:</p>
        <ul>
          <li>Privacy: <a href="mailto:privacy@13c.online">privacy@13c.online</a></li>
          <li>General support: <a href="mailto:support@13c.online">support@13c.online</a></li>
        </ul>
        <p>
          You may also contact the National Privacy Commission at{" "}
          <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a>.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
