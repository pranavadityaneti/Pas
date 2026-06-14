/**
 * In-app agreement read view — Phase 0.3 (2026-06-14).
 *
 * Presentational RN component that renders the SAME content the signed PDF uses
 * (Merchant Details header + personalized recital + all legal sections), so the
 * merchant reads exactly what they sign. Scroll-to-end gating + the signature
 * step live in the Step 4 screen (Phase 2); this component is layout only.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AgreementType, MerchantAgreementData, Clause, Section } from '../content/types';
import { getAgreementBody, AGREEMENT_VARIANT_LABEL } from '../content';
import { maskAadhaar } from '../buildAgreementHtml';

interface Props {
  type: AgreementType;
  merchant: MerchantAgreementData;
}

/**
 * Personalized parties recital. NOTE: keep this wording in sync with the recital
 * built in buildAgreementHtml.ts (the HTML version bolds the party names).
 */
function recitalText(m: MerchantAgreementData): string {
  return (
    'This Merchant Agreement ("Agreement") is entered into between PAS RETAIL NETWORKS ' +
    'Private Limited, a company incorporated under the Companies Act, 2013, having its ' +
    'registered office in India ("Pick At Store", "PAS", "Platform", "Company", "We", "Us", ' +
    `"Our"), and ${m.businessName}, having its principal place of business at ${m.placeOfBusiness}, ` +
    `acting through its authorised signatory ${m.signatoryName} (${m.designation}) ` +
    '("Merchant", "You", "Your").'
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailKey}>{label}</Text>
      <Text style={styles.detailVal}>{value}</Text>
    </View>
  );
}

function ClauseView({ clause }: { clause: Clause }) {
  const hasHead = !!(clause.n || clause.title);
  return (
    <View style={styles.clause}>
      {hasHead && (
        <Text style={styles.clauseHead}>
          {clause.n ? <Text style={styles.clauseNum}>{clause.n} </Text> : null}
          {clause.title ? <Text style={styles.clauseTitle}>{clause.title}</Text> : null}
        </Text>
      )}
      {clause.text
        ? clause.text.split('\n\n').map((para, i) => (
            <Text key={i} style={styles.clauseText}>
              {para}
            </Text>
          ))
        : null}
      {clause.bullets?.map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>{'•'}</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHead}>
        {section.n}. {section.title}
      </Text>
      {section.clauses.map((c, i) => (
        <ClauseView key={i} clause={c} />
      ))}
    </View>
  );
}

export default function AgreementDocumentView({ type, merchant }: Props) {
  const body = getAgreementBody(type);
  const variant = AGREEMENT_VARIANT_LABEL[type];

  return (
    <View style={styles.doc}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>MERCHANT AGREEMENT</Text>
        <Text style={styles.subtitle}>PAS Retail Networks Private Limited · {variant}</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.detailsLabel}>MERCHANT DETAILS</Text>
        <DetailRow label="Merchant / business name" value={merchant.businessName} />
        <DetailRow label="Store category" value={merchant.storeCategory} />
        <DetailRow label="Authorised signatory" value={`${merchant.signatoryName} — ${merchant.designation}`} />
        <DetailRow label="Principal place of business" value={merchant.placeOfBusiness} />
        <DetailRow label="PAN" value={merchant.pan} />
        <DetailRow label="Aadhaar (masked)" value={maskAadhaar(merchant.aadhaar)} />
        {merchant.gstin ? <DetailRow label="GSTIN" value={merchant.gstin} /> : null}
        <DetailRow label="FSSAI licence" value={merchant.fssai || '—'} />
        <DetailRow label="Contact" value={`${merchant.phone} · ${merchant.email}`} />
        <DetailRow label="Merchant ID" value={merchant.merchantId} />
        <DetailRow label="Date of acceptance" value={merchant.acceptanceDate} />
      </View>

      <Text style={styles.recital}>{recitalText(merchant)}</Text>
      <Text style={styles.recital}>{body.bindingClause}</Text>

      {body.sections.map((s) => (
        <SectionView key={s.n} section={s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  doc: { paddingBottom: 8 },
  titleBlock: { alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: '#1f2937', letterSpacing: 0.5 },
  subtitle: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  detailsCard: {
    backgroundColor: '#FFFBEF',
    borderWidth: 1,
    borderColor: '#F0D98A',
    borderRadius: 8,
    padding: 12,
    marginVertical: 14,
  },
  detailsLabel: { fontSize: 10, fontWeight: '700', color: '#7a5b00', letterSpacing: 1, marginBottom: 8 },
  detailRow: { flexDirection: 'row', paddingVertical: 2.5 },
  detailKey: { flex: 0.42, fontSize: 11, color: '#6b7280', paddingRight: 8 },
  detailVal: { flex: 0.58, fontSize: 11, color: '#1f2937' },
  recital: { fontSize: 12, color: '#1f2937', lineHeight: 18, marginBottom: 10 },
  section: { marginTop: 12 },
  sectionHead: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 6 },
  clause: { marginBottom: 7 },
  clauseHead: { fontSize: 12, color: '#111827', marginBottom: 2 },
  clauseNum: { fontWeight: '700' },
  clauseTitle: { fontWeight: '700' },
  clauseText: { fontSize: 11.5, color: '#374151', lineHeight: 17, marginBottom: 5 },
  bulletRow: { flexDirection: 'row', marginLeft: 6, marginBottom: 2 },
  bulletDot: { fontSize: 11.5, color: '#374151', marginRight: 6, lineHeight: 17 },
  bulletText: { flex: 1, fontSize: 11.5, color: '#374151', lineHeight: 17 },
});
