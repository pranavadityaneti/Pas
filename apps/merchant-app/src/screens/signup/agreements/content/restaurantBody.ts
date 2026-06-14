/**
 * Restaurant vendor agreement body — Phase 0.1 (2026-06-14).
 *
 * Verbatim from Final_Vendor Agreement - For restaurants.pdf. Routed to:
 *   - Restaurants & Cafes  (premium, ₹2,999)
 *   - Bakeries & Desserts  (food + dining-enabled — Pranav's routing decision;
 *     fee/commission reconciliation deferred, see forlater.md item B)
 *
 * Differences vs the standard body (all preserved verbatim):
 *   - Section 6 "DINING SERVICES" is inserted, shifting sections 6–19 up by one.
 *   - The standard body's mid-document "POLICY FRAMEWORK" (its section 20) is
 *     absent here, so numbering realigns from section 21 (Governing Law) onward.
 *   - Two-tier commission (3.3 pickup 5% / 3.4 pickup+dining 7%) + a dining
 *     upgrade clause (3.5); ₹2,999 onboarding fee.
 *   - Food/allergen/hygiene wording in 4.2, 5.1, 5.3, 5.4; "Menus" in the IP
 *     license (11.1); "Food quality or safety issues" in indemnity (17);
 *     30-day termination notice (19.2).
 * Preserves the source numbering quirk (33 → 35, no section 34).
 */

import type { AgreementBody } from './types';

export const restaurantBody: AgreementBody = {
  bindingClause:
    'By signing this Agreement, completing onboarding, listing products or services, accepting orders or reservations, or otherwise using the Platform, the Merchant agrees to be bound by the terms contained herein.',
  sections: [
    {
      n: '1',
      title: 'APPOINTMENT AND SCOPE',
      clauses: [
        { n: '1.1', title: 'Platform Services', text: 'PAS operates a technology platform that enables customers to discover merchants, place orders, schedule pickups, make dining reservations, pre-order food and beverages, and access related services.' },
        { n: '1.2', title: 'Nature of Relationship', text: 'PAS acts solely as a technology intermediary facilitating interactions and transactions between customers and merchants through the Platform. PAS does not own merchant inventory, manufacture products, prepare food or beverages, operate merchant premises, employ merchant personnel, control merchant operations, or act as the agent, representative, partner, employer, or legal representative of the Merchant.' },
        { n: '1.3', title: 'Independent Parties', text: 'Nothing in this Agreement shall be construed as creating a partnership, joint venture, agency, franchise, employment, or fiduciary relationship between PAS and the Merchant.' },
        { n: '1.4', title: 'Non-Exclusive Arrangement', text: 'The relationship established under this Agreement is non-exclusive. Either party may enter into similar arrangements with third parties.' },
      ],
    },
    {
      n: '2',
      title: 'MERCHANT ELIGIBILITY AND REPRESENTATIONS',
      clauses: [
        { text: 'The Merchant represents, warrants, and undertakes that:' },
        { n: '2.1', text: 'It is duly organized, validly existing, and legally authorized to conduct its business.' },
        { n: '2.2', text: 'It possesses and shall maintain throughout the term of this Agreement all licenses, permits, registrations, certifications, and approvals required under applicable law.' },
        { n: '2.3', text: 'All information, documentation, menus, product descriptions, pricing information, photographs, trademarks, and business details provided to PAS are accurate, complete, and not misleading.' },
        { n: '2.4', text: 'The Merchant shall promptly notify PAS of any material changes affecting its business operations, licenses, ownership, location, or legal status.' },
      ],
    },
    {
      n: '3',
      title: 'COMMERCIAL TERMS',
      clauses: [
        { n: '3.1', title: 'Onboarding Fee', text: 'The Merchant shall pay a one-time onboarding fee of INR 2,999 plus applicable taxes for each restaurant branch listed on the Platform.' },
        { n: '3.2', title: 'Additional Branches', text: 'The onboarding fee applies to a single restaurant outlet only. Each additional outlet added at onboarding or subsequently shall require payment of the applicable onboarding fee for such outlet.' },
        { n: '3.3', title: 'Pickup Commission', text: 'For restaurants offering pickup services only, PAS shall be entitled to a commission of five percent (5%) of the gross order value of each successfully completed pickup order placed through the Platform.' },
        { n: '3.4', title: 'Pickup and Dining Commission', text: 'For restaurants offering both pickup and dining services through the Platform, PAS shall be entitled to a commission of seven percent (7%) of the gross order value of orders originating through the Platform.' },
        { n: '3.5', title: 'Upgrade to Dining Services', text: 'A restaurant initially enrolled under the pickup-only model may activate dining services at a later stage upon acceptance of the applicable commercial terms and payment of any applicable fees notified by PAS.' },
        { n: '3.6', title: 'Taxes', text: 'All fees, commissions, and charges under this Agreement are exclusive of applicable taxes. GST and other applicable taxes shall be levied, collected, and remitted in accordance with applicable law.' },
        {
          n: '3.7',
          title: 'Settlement',
          text:
            'PAS shall remit payments to the Merchant after deducting applicable commissions, approved refunds, approved adjustments, taxes, government deductions, and other agreed charges.\n\n' +
            'Unless otherwise notified by PAS in writing, settlements shall be processed on a T+2 basis, where "T" refers to the date on which an order is successfully completed and marked as fulfilled on the Platform, and settlement shall ordinarily be initiated within two (2) business days thereafter.\n\n' +
            'Settlement timelines may be reasonably adjusted in cases involving refunds, disputes, investigations, technical issues, banking delays, regulatory requirements, fraud prevention measures, public holidays, or circumstances beyond PAS\'s reasonable control.',
        },
        { n: '3.8', title: 'Revision of Commercial Terms', text: 'PAS may revise commissions, onboarding fees, settlement schedules, or other commercial terms by providing reasonable prior notice through official communication channels.' },
      ],
    },
    {
      n: '4',
      title: 'COMPLIANCE WITH LAWS',
      clauses: [
        { n: '4.1', text: 'Each party shall comply with all applicable laws, regulations, governmental orders, licensing requirements, and statutory obligations relevant to its activities under this Agreement.' },
        { n: '4.2', text: 'The Merchant shall comply with all laws applicable to its products, services, food preparation, storage, handling, packaging, advertising, and sale.' },
        { n: '4.3', text: 'The Merchant shall obtain, maintain, and renew all registrations, licenses, permits, certifications, approvals, and authorizations required for the lawful operation of its business and the sale of its products or services, including but not limited to tax registrations, food safety registrations where applicable, trade licenses, municipal approvals, regulatory registrations, product-specific certifications, and any other approvals required under applicable law.' },
      ],
    },
    {
      n: '5',
      title: 'MERCHANT RESPONSIBILITIES',
      clauses: [
        { n: '5.1', title: 'Product and Service Quality', text: 'The Merchant shall be solely responsible for the quality, authenticity, safety, preparation, storage, handling, packaging, labeling, ingredient and allergen disclosures, description, hygiene, service standards, and regulatory compliance of all food, beverages, products, and services offered through the Platform and for ensuring compliance with all applicable laws, regulations, food safety requirements, and industry standards.' },
        { n: '5.2', title: 'Customer Experience', text: 'The Merchant shall use reasonable efforts to provide a safe, lawful, and professional customer experience at its premises.' },
        { n: '5.3', title: 'Operational Readiness', text: 'The Merchant shall maintain adequate staff, inventory, seating capacity, and operational readiness to fulfill accepted orders and reservations.' },
        { n: '5.4', title: 'Accurate Information', text: 'The Merchant shall maintain accurate, complete, and up-to-date information on the Platform, including its business hours, inventory availability, menus, pricing, seating availability, store location, contact details, operational status, and any other information relevant to customer orders, reservations, or transactions.' },
      ],
    },
    {
      n: '6',
      title: 'DINING SERVICES',
      clauses: [
        { n: '6.1', text: 'PAS may provide technology services that facilitate table reservations, dining bookings, waitlist management, pre-ordering of food and beverages, and related dining services through the Platform.' },
        { n: '6.2', text: "The Merchant shall remain solely responsible for the operation and management of its establishment, including seating arrangements, reservation management, food and beverage preparation, service delivery, staff conduct, hygiene standards, customer handling, crowd management, waiting periods, and overall customer experience at the Merchant's premises." },
        { n: '6.3', text: 'PAS does not guarantee customer attendance, reservation fulfillment, table occupancy, sales volume, revenue generation, customer spending levels, or any minimum level of business activity through the Platform.' },
        { n: '6.4', text: 'The Merchant acknowledges that customer no-shows, late arrivals, abandoned reservations, or booking cancellations may occur. Such matters shall be governed by applicable Platform policies and customer-facing Terms and Conditions.' },
        { n: '6.5', text: 'The Merchant may control its operational availability through Platform tools provided by PAS. However, once an order or reservation is accepted, the Merchant shall use reasonable efforts to honor such commitment.' },
        { n: '6.6', text: 'The Merchant shall be responsible for managing customer queues, crowd management, waiting periods, and peak-hour operations at its premises.' },
      ],
    },
    {
      n: '7',
      title: 'PROHIBITED PRODUCTS AND SERVICES',
      clauses: [
        {
          text: 'The Merchant shall not list, sell, offer, or promote:',
          bullets: [
            'Illegal products;',
            'Counterfeit goods;',
            'Stolen goods;',
            'Expired products;',
            'Unsafe products;',
            'Prohibited products;',
            'Regulated products without required approvals.',
          ],
        },
        { text: 'PAS reserves the right to remove listings or suspend access where legal, regulatory, safety, or reputational concerns arise.' },
      ],
    },
    {
      n: '8',
      title: 'ORDERS, FULFILLMENT, AND OPERATIONS',
      clauses: [
        { n: '8.1', text: 'The Merchant shall process and fulfill accepted orders and reservations within applicable timelines communicated by PAS.' },
        { n: '8.2', text: 'The Merchant shall ensure accepted orders are available for pickup at the agreed pickup time.' },
        { n: '8.3', text: 'The Merchant shall maintain accurate operational status and availability on the Platform.' },
        { n: '8.4', text: 'Repeated failure to fulfill accepted orders or reservations may result in warnings, suspension, or termination.' },
        { n: '8.5', text: 'The Merchant shall not repeatedly accept and subsequently reject orders without valid operational reasons.' },
      ],
    },
    {
      n: '9',
      title: 'RETURNS, REFUNDS, EXCHANGES, AND DISPUTE RESOLUTION',
      clauses: [
        { n: '9.1', text: 'Customer requests relating to cancellations, refunds, returns, exchanges, order issues, product concerns, dining disputes, or service complaints shall be handled in accordance with PAS policies and applicable law.' },
        { n: '9.2', text: 'PAS may seek information from both the customer and the Merchant before making a determination.' },
        { n: '9.3', text: 'PAS shall review available information and make a commercially reasonable determination in accordance with applicable policies, available evidence, and applicable law.' },
        { n: '9.4', text: 'The Merchant agrees to cooperate with investigations and provide supporting information when reasonably requested.' },
        { n: '9.5', text: 'Where a refund, adjustment, credit, compensation, return, or exchange is approved, PAS may adjust future settlements accordingly.' },
      ],
    },
    {
      n: '10',
      title: 'DATA PRIVACY AND CONFIDENTIALITY',
      clauses: [
        { n: '10.1', text: 'Customer information shall be used solely for legitimate transaction-related purposes.' },
        { n: '10.2', text: 'The Merchant shall not misuse, sell, disclose, transfer, or exploit customer information except as permitted by law.' },
        { n: '10.3', text: 'Both parties shall maintain the confidentiality of non-public business information obtained through the relationship.' },
        { n: '10.4', text: 'Confidentiality obligations shall survive termination of this Agreement.' },
      ],
    },
    {
      n: '11',
      title: 'INTELLECTUAL PROPERTY',
      clauses: [
        {
          n: '11.1',
          text: "The Merchant grants PAS a non-exclusive, royalty-free, revocable license to use the Merchant's:",
          bullets: ['Business name;', 'Store name;', 'Logos;', 'Product images;', 'Menus;', 'Marketing materials;'],
        },
        { text: 'for operating, promoting, marketing, and improving Platform services.' },
        { n: '11.2', text: 'The Merchant warrants that it possesses all rights necessary to grant such license.' },
      ],
    },
    {
      n: '12',
      title: 'CUSTOMER REVIEWS AND RATINGS',
      clauses: [
        { n: '12.1', text: 'PAS may publish customer ratings, reviews, and feedback relating to the Merchant.' },
        { n: '12.2', text: 'The Merchant shall not manipulate, fabricate, purchase, incentivize, or otherwise interfere with review systems.' },
        { n: '12.3', text: 'PAS may moderate reviews in accordance with applicable policies and legal requirements.' },
      ],
    },
    {
      n: '13',
      title: 'REGULATORY COOPERATION',
      clauses: [
        { n: '13.1', text: 'The Merchant shall reasonably cooperate with PAS in responding to lawful requests from courts, regulators, consumer authorities, law enforcement agencies, government departments, or other competent authorities.' },
        { n: '13.2', text: 'The Merchant shall promptly provide documents and information reasonably required in connection with investigations, disputes, audits, regulatory inquiries, or legal proceedings relating to transactions conducted through the Platform.' },
      ],
    },
    {
      n: '14',
      title: 'PLATFORM MONITORING AND PERFORMANCE STANDARDS',
      clauses: [
        { n: '14.1', text: 'PAS may monitor merchant performance to maintain platform quality, customer trust, and regulatory compliance.' },
        { n: '14.2', text: 'In assessing merchant performance, PAS may consider factors including customer complaints, order fulfillment performance, product quality, service quality, compliance history, operational reliability, responsiveness to customer concerns, adherence to Platform policies, and any other factors reasonably relevant to maintaining customer trust, operational standards, and regulatory compliance.' },
        { n: '14.3', text: 'Where repeated service deficiencies, customer complaints, operational failures, or policy violations are identified, PAS may issue written warnings to the Merchant.' },
        { n: '14.4', text: "Upon accumulation of three (3) warnings within a rolling twelve-month period, PAS may suspend or terminate the Merchant's access following review of the circumstances." },
        {
          n: '14.5',
          text: 'PAS may immediately suspend or terminate access in cases involving:',
          bullets: ['Fraud;', 'Illegal activity;', 'Serious safety concerns;', 'Regulatory violations;', 'Material breach of this Agreement.'],
        },
      ],
    },
    {
      n: '15',
      title: 'CUSTOMER CONDUCT',
      clauses: [
        { n: '15.1', text: 'PAS does not control customer conduct.' },
        { n: '15.2', text: 'Each Merchant remains responsible for maintaining a safe and lawful environment within its establishment.' },
        { n: '15.3', text: 'PAS shall not ordinarily be responsible for acts or omissions of customers occurring at Merchant premises, except to the extent required under applicable law.' },
      ],
    },
    {
      n: '16',
      title: 'PLATFORM AVAILABILITY',
      clauses: [
        { n: '16.1', text: 'PAS shall use reasonable efforts to maintain platform availability.' },
        { n: '16.2', text: "The Merchant acknowledges that interruptions, delays, temporary unavailability, or degradation of Platform services may occur due to maintenance activities, internet or telecommunications disruptions, cyber incidents, third-party service failures, software updates, system upgrades, regulatory requirements, security measures, or other events beyond PAS's reasonable control." },
      ],
    },
    {
      n: '17',
      title: 'INDEMNITY',
      clauses: [
        {
          text: 'The Merchant shall indemnify and hold harmless PAS, its directors, officers, employees, affiliates, and representatives from claims, liabilities, penalties, losses, damages, costs, and expenses arising from:',
          bullets: [
            'Product defects;',
            'Food quality or safety issues;',
            'Regulatory violations;',
            'Intellectual property infringement;',
            'Merchant negligence;',
            'Merchant misconduct;',
            'Breach of this Agreement.',
          ],
        },
      ],
    },
    {
      n: '18',
      title: 'LIMITATION OF LIABILITY',
      clauses: [
        { n: '18.1', text: 'To the maximum extent permitted by law, PAS shall not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages.' },
        { n: '18.2', text: "PAS's aggregate liability arising out of or relating to this Agreement shall not exceed the total commissions earned by PAS from the Merchant during the three (3) months immediately preceding the event giving rise to the claim." },
      ],
    },
    {
      n: '19',
      title: 'TERM AND TERMINATION',
      clauses: [
        { n: '19.1', text: 'This Agreement shall remain in effect until terminated by either party.' },
        { n: '19.2', text: 'Either party may terminate this Agreement by providing thirty (30) days prior written notice to the other party.' },
        { n: '19.3', text: 'PAS may immediately suspend or terminate access where reasonably required for legal compliance, customer protection, operational integrity, fraud prevention, or risk management.' },
      ],
    },
    {
      n: '20',
      title: 'FORCE MAJEURE',
      clauses: [
        {
          text: 'Neither party shall be liable for delays or failures caused by events beyond its reasonable control, including:',
          bullets: [
            'Natural disasters;',
            'Floods;',
            'Fires;',
            'Epidemics or pandemics;',
            'Government restrictions;',
            'Civil disturbances;',
            'Telecommunications failures;',
            'Cyber incidents;',
            'Utility failures.',
          ],
        },
      ],
    },
    {
      n: '21',
      title: 'GOVERNING LAW AND JURISDICTION',
      clauses: [
        { n: '21.1', text: 'This Agreement shall be governed by and construed in accordance with the laws of India.' },
        { n: '21.2', text: 'Subject to applicable law, courts located in Hyderabad, Telangana shall have exclusive jurisdiction over disputes arising out of or relating to this Agreement.' },
      ],
    },
    {
      n: '22',
      title: 'DATA PROTECTION',
      clauses: [
        { text: "PAS and the Merchant shall process personal data in accordance with the Digital Personal Data Protection Act, 2023 and all other applicable privacy and data protection laws. The Merchant shall collect, access, use, store, and process customer personal data solely for lawful purposes directly related to order fulfillment, reservation management, customer support, transaction processing, and services provided through the Platform, and shall implement reasonable technical, organizational, and administrative safeguards to protect such data against unauthorized access, disclosure, misuse, alteration, loss, or destruction. The Merchant shall promptly notify PAS of any actual, suspected, or reasonably foreseeable personal data breach affecting customer information and shall cooperate with PAS in investigating and responding to such incidents. The Merchant shall not sell, transfer, disclose, exploit, or otherwise misuse customer personal data except as permitted by applicable law and shall securely delete or anonymize such data when it is no longer required for lawful business purposes or as otherwise required by applicable law. PAS's Privacy Policy, as amended from time to time, shall govern customer-facing data processing activities conducted through the Platform." },
      ],
    },
    {
      n: '23',
      title: 'PAYMENT SERVICES',
      clauses: [
        { text: "Payments made through the Platform may be processed by third-party payment gateways, payment aggregators, banks, UPI networks, and other payment service providers engaged by PAS from time to time. The Merchant acknowledges and agrees that PAS does not control the operations of such third-party service providers and shall not be responsible for any payment failures, transaction declines, processing errors, settlement delays, banking interruptions, UPI failures, payment gateway outages, technical disruptions, incorrect bank account details provided by the Merchant, or any other failures, delays, or losses attributable to third-party payment service providers or financial institutions. PAS shall use commercially reasonable efforts to assist in resolving payment-related issues but does not guarantee uninterrupted or error-free payment processing services." },
      ],
    },
    {
      n: '24',
      title: 'ELECTRONIC EXECUTION',
      clauses: [
        { text: 'This Agreement may be accepted electronically through the Platform and such acceptance shall constitute a legally binding agreement equivalent to a physical signature.' },
      ],
    },
    {
      n: '25',
      title: 'TAX RESPONSIBILITY',
      clauses: [
        { text: "The Merchant shall be solely responsible for complying with all applicable tax laws and regulatory requirements, including obtaining and maintaining GST registration where required, issuing invoices and tax documents in accordance with applicable law, collecting, reporting, and remitting all applicable taxes, filing tax returns and statutory declarations, maintaining accurate books of account, records, and supporting documentation, and fulfilling any other tax-related obligations arising from its business operations or transactions conducted through the Platform. PAS shall not be responsible for the Merchant's tax compliance, reporting obligations, filings, assessments, penalties, interest, or liabilities, except to the extent expressly required under applicable law." },
      ],
    },
    {
      n: '26',
      title: 'ANTI FRAUD AND ETHICAL CONDUCT',
      clauses: [
        { text: "The Merchant shall not engage in or facilitate any fraudulent, deceptive, unlawful, or unethical activity, including but not limited to fraudulent transactions, fake orders, fake reservations, review manipulation, artificial inflation of ratings or Platform metrics, money laundering, bribery, corruption, misrepresentation, identity fraud, abuse of promotional programs, or any activity intended to deceive customers, PAS, payment service providers, regulators, or other stakeholders. The Merchant shall conduct its business in a lawful, honest, and ethical manner and shall comply with all applicable anti-corruption, anti-money laundering, and fraud prevention laws. PAS reserves the right to investigate suspected misconduct and may immediately suspend, restrict, or terminate the Merchant's access to the Platform upon discovery or reasonable suspicion of any such activity." },
      ],
    },
    {
      n: '27',
      title: 'SURVIVAL',
      clauses: [
        { text: 'Notwithstanding the termination or expiration of this Agreement for any reason, all provisions which by their nature are intended to survive termination shall continue in full force and effect, including without limitation provisions relating to confidentiality, data protection and privacy obligations, intellectual property rights, indemnities, limitation of liability, regulatory cooperation, tax obligations, governing law, jurisdiction, dispute resolution, outstanding payment obligations, settlements, refunds, audits, investigations, and any accrued rights, remedies, liabilities, or obligations of either party arising prior to the effective date of termination. Such provisions shall remain binding upon the parties for the period required by applicable law or, where no such period is specified, for so long as necessary to give effect to their purpose.' },
      ],
    },
    {
      n: '28',
      title: 'MERCHANT VERIFICATION',
      clauses: [
        { text: 'The Merchant acknowledges that PAS may conduct onboarding, identity verification, business verification, license verification, compliance checks, background screening, and periodic re-verification exercises. PAS may request additional information or documentation at any time and may suspend, restrict, or terminate access where verification requirements are not satisfied or where information provided is inaccurate, incomplete, misleading, or suspected to be fraudulent.' },
      ],
    },
    {
      n: '29',
      title: 'CHARGEBACK CLAUSE',
      clauses: [
        { text: 'Where a payment is reversed, charged back, disputed, refunded, or otherwise recovered by a bank, payment gateway, card network, UPI provider, regulatory authority, or other payment service provider, PAS may recover the corresponding amount and any associated costs, penalties, fees, or losses from future Merchant settlements or by any other lawful means.' },
      ],
    },
    {
      n: '30',
      title: 'MARKETING AND PROMOTIONS CLAUSE',
      clauses: [
        { text: 'PAS may feature, advertise, promote, or market the Merchant, its products, services, menus, trademarks, logos, images, offers, or promotional campaigns through the Platform, social media channels, marketing materials, digital advertisements, influencer campaigns, and other promotional activities. Participation in certain promotional programs may be subject to additional commercial terms communicated by PAS from time to time.' },
      ],
    },
    {
      n: '31',
      title: 'ASSIGNMENT',
      clauses: [
        { text: "The Merchant shall not assign, transfer, delegate, sublicense, or otherwise transfer any rights or obligations under this Agreement without PAS's prior written consent. PAS may assign or transfer this Agreement to an affiliate, successor, acquirer, investor-backed entity, or as part of a merger, acquisition, restructuring, financing, or sale of business assets upon notice to the Merchant." },
      ],
    },
    {
      n: '32',
      title: 'GRIEVANCE REDRESSAL',
      clauses: [
        {
          text:
            'In accordance with applicable laws, including the Information Technology Act, 2000, the Consumer Protection (E-Commerce) Rules, 2020, and other applicable regulations, PAS shall designate a Grievance Officer for addressing complaints, grievances, and concerns relating to the Platform. The Grievance Officer may be contacted at\n' +
            'Grievance Officer: Krishna Onguru\n' +
            'Email: krishna@pickatstore.io\n' +
            'Contact: 7842287373\n' +
            'Address: 3rd Floor, Plot No:19, TSSP Battalion road, Kondapur, Hanuman Nagar, K.V, Kondapur, Serilingampalle (M), Hyderabad, Telangana 500084.\n\n' +
            'PAS shall endeavor to acknowledge complaints within forty-eight (48) hours of receipt and resolve such complaints within the timelines prescribed under applicable law. The Merchant agrees to reasonably cooperate with PAS and the Grievance Officer in investigating and resolving complaints, disputes, regulatory inquiries, and customer grievances arising from transactions conducted through the Platform.',
        },
      ],
    },
    {
      n: '33',
      title: 'POLICY FRAMEWORK',
      clauses: [
        { n: '33.1', text: 'The Merchant acknowledges that customer-facing Terms and Conditions, cancellation policies, refund policies, exchange policies, dining policies, operational guidelines, and other Platform rules published by PAS may apply to transactions conducted through the Platform.' },
        { n: '33.2', text: 'The Merchant agrees to comply with such policies as may be communicated by PAS from time to time.' },
        { n: '33.3', text: 'PAS may revise such policies in response to legal requirements, operational needs, fraud prevention measures, business requirements, or platform enhancements.' },
        { n: '33.4', text: 'PAS shall provide reasonable notice of material changes through official communication channels.' },
      ],
    },
    {
      n: '35',
      title: 'ENTIRE AGREEMENT',
      clauses: [
        { text: 'This Agreement constitutes the complete understanding between PAS and the Merchant and supersedes all prior discussions, negotiations, representations, understandings, and agreements relating to its subject matter.' },
      ],
    },
  ],
};
