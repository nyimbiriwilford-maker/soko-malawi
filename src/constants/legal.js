/**
 * SokoMw legal content — Terms & Conditions and Privacy Policy.
 * Shown on the login page; users must agree before creating an account.
 * Drafted against the app's real features (marketplace, shops, jobs, services,
 * looking-for, statuses, chats/calls, vouching, featured listings) and the
 * Malawi Data Protection Act, 2024 (MACRA is the data protection authority).
 */

export const LEGAL = {
  appName: 'SokoMw',
  legalName: 'SokoMw Marketplace',
  contactEmail: 'support@sokomw.com',
  jurisdiction: 'the Republic of Malawi',
  effectiveDate: '15 August 2026',
  featuredPriceMwk: 'MWK 2,500',
  featuredDurationDays: 7,
  minimumAge: 18,
}

export const TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of These Terms',
    body:
      'Welcome to SokoMw, a digital marketplace that connects buyers, sellers, service providers, job seekers and employers across Malawi. By creating an account, logging in, browsing or using any part of the SokoMw platform (the "Platform"), you agree to be bound by these Terms & Conditions (the "Terms"). If you do not agree with any part of these Terms, you must not create an account or use the Platform. When you tick the "I agree" box during sign-up, that tick forms a legally binding agreement between you and SokoMw.',
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    body:
      `You must be at least ${LEGAL.minimumAge} years old to create an account or use the Platform. By creating an account you confirm that you are of legal age in ${LEGAL.jurisdiction} and have full legal capacity to enter into this agreement. You may only hold one account and you must provide accurate, complete and current information (including a valid email address). SokoMw may verify your identity and age at any time and may suspend or close accounts that fail such checks.`,
  },
  {
    id: 'account',
    title: '3. Account Registration & Security',
    body:
      'You are responsible for everything done through your account. Keep your password secret, choose a strong password, and notify SokoMw immediately if you suspect unauthorised access. You may not share your login credentials, sell or transfer your account, or create accounts through automated means. One-time passwords (OTP) sent to your email are confidential — never share them with anyone, including people claiming to be SokoMw staff. We will never ask for your OTP or password.',
  },
  {
    id: 'platform-use',
    title: '4. Using the Platform',
    body:
      'SokoMw provides a venue for users to list products, open shops, offer and request services, post and find jobs, publish "Looking For" requests, share status updates, chat, call and confirm deals. You may use the Platform only for lawful, personal and commercial purposes consistent with these Terms. You agree not to misuse the Platform, attempt to access systems you are not authorised for, interfere with other users, or use bots, scrapers or automated tools without our written permission.',
  },
  {
    id: 'user-content',
    title: '5. Your Content & Listings',
    body:
      'You are solely responsible for everything you post — listings, shop details, job posts, service offers, "Looking For" requests, statuses, photos, videos, reviews, vouches and messages. You confirm that: (a) you own or have permission to use everything you upload; (b) your content is true, accurate and not misleading; (c) items you sell are genuine and lawfully yours; and (d) prices are stated honestly in Malawian Kwacha (MWK). By posting content you grant SokoMw a non-exclusive, royalty-free licence to store, display and process it to operate the Platform. You must remove or correct content that becomes inaccurate.',
  },
  {
    id: 'prohibited',
    title: '6. Prohibited Content & Conduct',
    body:
      'You must not post or do anything that is illegal, fraudulent, counterfeit, stolen, obscene, defamatory, hateful, threatening, harassing, or that infringes someone else\'s rights. Without limitation, you may not list weapons, ammunition, drugs, or other items prohibited by the laws of Malawi; misrepresent the condition or origin of goods; artificially inflate trust scores or vouch scores; create fake accounts, fake listings or fake deals; share other people\'s personal data without consent; or attempt to transact outside the Platform to avoid platform rules. SokoMw may remove any content and suspend any account that violates these rules, without notice.',
  },
  {
    id: 'transactions',
    title: '7. Transactions Between Users',
    body:
      'SokoMw is a platform that facilitates introductions and communication. It is not a party to any sale, hire, service or job contract between users, and does not hold goods or guarantee payments. All agreements, pricing, delivery, payment and performance are between the users directly, at their own risk. Always deal honestly and fairly: only confirm a "deal" when a real transaction has taken place — fake deal confirmations are detected and lead to suspension. When meeting in person, choose a public place, bring someone you trust, inspect goods before paying, and never share your OTP or banking secrets.',
  },
  {
    id: 'fees',
    title: '8. Fees & Paid Features',
    body:
      `Creating an account, browsing and posting most content is free. Certain optional features cost money. A "Featured Listing" currently costs ${LEGAL.featuredPriceMwk} and runs for ${LEGAL.featuredDurationDays} days — pricing may change with notice. Fees are paid by the methods offered on the Platform and are non-refundable except where required by law. SokoMw may introduce, change or withdraw fees at any time; you will be told the applicable fee before you pay.`,
  },
  {
    id: 'trust',
    title: '9. Verification, Vouching & Trust',
    body:
      'SokoMw provides optional verification badges, vouch scores and trust tiers to help users judge each other. These are community signals only — they are not guarantees of identity, quality or behaviour. Verification status may be withdrawn if you do not meet the requirements. Vouching for someone who later commits fraud, or arranging mutual/fake vouches, may result in suspension.',
  },
  {
    id: 'calls-chats',
    title: '10. Chats & Calls',
    body:
      'SokoMw offers messaging and audio/video calling between users. You agree to use these for genuine platform conversations only. Do not use calls or chats to harass, defraud, spam or share harmful content. Recordings, if any, are subject to our Privacy Policy and applicable law.',
  },
  {
    id: 'ip',
    title: '11. Intellectual Property',
    body:
      'The SokoMw name, logo, design, and platform software are the property of SokoMw and its licensors. You may not copy, reproduce or use them without permission. Your content remains yours, subject to the licence granted in these Terms.',
  },
  {
    id: 'privacy',
    title: '12. Privacy & Data Protection',
    body:
      `We process your personal data in line with our Privacy Policy (available on the sign-up page) and the Malawi Data Protection Act, 2024. By using the Platform you consent to the collection and processing described there, including the transfer of data to our service providers. You may exercise your rights to access, correct, delete, restrict and port your data by contacting us at ${LEGAL.contactEmail}.`,
  },
  {
    id: 'disclaimer',
    title: '13. No Warranties',
    body:
      'The Platform is provided "as is" and "as available" without warranties of any kind, whether express or implied, including accuracy, reliability, availability or fitness for a particular purpose. SokoMw does not verify every user, item or listing and does not warrant that any transaction will be safe, legal or successful. You rely on the Platform and other users at your own risk.',
  },
  {
    id: 'liability',
    title: '14. Limitation of Liability',
    body:
      `To the maximum extent permitted by the laws of ${LEGAL.jurisdiction}, SokoMw shall not be liable for indirect, incidental, special or consequential damages, loss of profits, data or goodwill, or for any loss arising from disputes between users. SokoMw\'s total liability arising out of or related to the Platform shall not exceed the total fees you have paid to SokoMw in the three months before the event giving rise to liability. Nothing in these Terms excludes liability that cannot lawfully be excluded.`,
  },
  {
    id: 'indemnity',
    title: '15. Indemnification',
    body:
      'You agree to indemnify and hold harmless SokoMw, its owners, staff and service providers from any claims, losses, damages or expenses (including legal fees) arising out of your use of the Platform, your content, or your breach of these Terms.',
  },
  {
    id: 'termination',
    title: '16. Suspension & Termination',
    body:
      'SokoMw may suspend or close your account, remove your content, or restrict your access if you breach these Terms, behave fraudulently or abusively, or if required by law. You may close your account at any time by contacting us. Where your account is closed, content you posted may be removed and any outstanding obligations to other users remain your responsibility.',
  },
  {
    id: 'disputes',
    title: '17. Disputes & Governing Law',
    body:
      `These Terms are governed by the laws of ${LEGAL.jurisdiction}. You and SokoMw agree to first try to resolve any dispute informally by contacting support at ${LEGAL.contactEmail}. Disputes not resolved informally shall be subject to the exclusive jurisdiction of the courts of ${LEGAL.jurisdiction}.`,
  },
  {
    id: 'changes',
    title: '18. Changes to These Terms',
    body:
      'We may update these Terms from time to time. The latest version will always be shown on the sign-up page, and significant changes will be highlighted. Continuing to use the Platform after changes take effect means you accept the updated Terms. Continued use of the Platform is your acceptance of any revised Terms.',
  },
  {
    id: 'general',
    title: '19. General Provisions',
    body:
      'If any part of these Terms is found to be unenforceable, the rest remains in force. Our failure to enforce a provision is not a waiver. These Terms are the entire agreement between you and SokoMw regarding the Platform. You may not assign your account or rights without our consent.',
  },
  {
    id: 'contact',
    title: '20. Contact Us',
    body:
      `Questions about these Terms or the Platform can be sent to ${LEGAL.contactEmail}.`,
  },
]

export const PRIVACY_SECTIONS = [
  {
    id: 'p-intro',
    title: '1. Who We Are',
    body:
      `This Privacy Policy explains how SokoMw collects, uses, stores and protects your personal data when you use the Platform. It applies to all users in ${LEGAL.jurisdiction} and is intended to comply with the Malawi Data Protection Act, 2024, with the Malawi Communications Regulatory Authority (MACRA) as the data protection authority.`,
  },
  {
    id: 'p-data',
    title: '2. What We Collect',
    body:
      'When you create an account we collect your email address, password (stored only as a secure, encrypted hash), chosen username and full name. To improve the Platform and your experience we may also collect your avatar photo, phone / WhatsApp number, city and district, and, with your permission, location. We automatically collect limited technical data such as device type, browser, and how you use the Platform. We do not collect more data than is needed to run the Platform.',
  },
  {
    id: 'p-use',
    title: '3. How We Use Your Data',
    body:
      'We use your data to create and manage your account; allow you to post listings, shops, jobs, services and statuses; connect you with other users through search, chats, calls and notifications; confirm deals and calculate trust scores; prevent fraud and abuse; verify your email (via one-time codes) and secure the Platform (e.g. Cloudflare Turnstile); and to improve our services. We do not sell your personal data.',
  },
  {
    id: 'p-share',
    title: '4. Who We Share With',
    body:
      'Information you make public (listings, shop details, job posts, statuses, profile name and photo) is visible to other Platform users. We share your data with trusted service providers who help operate the Platform, such as our hosting provider (Supabase), email and security services, and payment providers — only to the extent needed, under written contracts that require them to protect your data. We may share data where required by law or to protect the rights and safety of users or the public.',
  },
  {
    id: 'p-rights',
    title: '5. Your Rights',
    body:
      `Under the Malawi Data Protection Act, 2024 you have the right to access your personal data, correct inaccuracies, request deletion, restrict or object to processing, and request a copy of your data in a portable format. You can update most details yourself in your profile. For other requests, email ${LEGAL.contactEmail}. If we are not able to resolve your concern, you may lodge a complaint with MACRA.`,
  },
  {
    id: 'p-security',
    title: '6. How We Protect Your Data',
    body:
      'We use appropriate technical and organisational measures to keep your data safe, including encryption in transit, access controls and restricted staff access. Passwords are stored as secure hashes only. No system is completely secure, but we work hard to protect your information.',
  },
  {
    id: 'p-breaches',
    title: '7. Data Breaches',
    body:
      'If a data breach is likely to put your rights at risk, we will notify you and the Malawi Communications Regulatory Authority (MACRA) within 72 hours of becoming aware of it, as required by law.',
  },
  {
    id: 'p-retention',
    title: '8. Retention',
    body:
      'We keep your data only as long as needed to operate your account and the Platform, or as required by law. When you close your account we delete or anonymise your personal data, except where we are legally required to keep records (for example, to prevent fraud or comply with tax and regulatory obligations).',
  },
  {
    id: 'p-transfer',
    title: '9. International Data Transfer',
    body:
      'Some of our service providers may be located outside Malawi. Where your personal data is transferred outside Malawi, we ensure appropriate safeguards are in place in line with the Malawi Data Protection Act, 2024.',
  },
  {
    id: 'p-children',
    title: '10. Children',
    body:
      `SokoMw is only for users aged ${LEGAL.minimumAge} and older. We do not knowingly collect data from children under ${LEGAL.minimumAge}. If you believe a child has provided us with personal data, contact ${LEGAL.contactEmail} and we will delete it.`,
  },
  {
    id: 'p-changes',
    title: '11. Changes to This Policy',
    body:
      'We may update this Privacy Policy from time to time. The latest version will always be available on the sign-up page. Significant changes will be notified to you, and continued use of the Platform means you accept the updated policy.',
  },
  {
    id: 'p-contact',
    title: '12. Contact Us',
    body:
      `For any privacy questions, to exercise your rights, or to reach our data protection contact, email ${LEGAL.contactEmail}.`,
  },
]
