/**
 * signAgreement — Phase 3 client side (2026-06-14).
 *
 * Orchestrates the on-device signing chain at Step 4:
 *   1. Render the personalized signed agreement HTML → PDF (expo-print)
 *   2. Upload the PDF to the private `merchant-docs` bucket under
 *      agreements/<userId>/ (reuses the proven base64 + base64-arraybuffer
 *      upload the app already uses for KYC docs)
 *   3. POST the consent record to the API (server stamps IP + doc hash and
 *      writes merchant_consents)
 *
 * Storage note: we reuse the existing private `merchant-docs` bucket rather than
 * a new one, so admin's SecureImage/createSignedUrl already has read access and
 * no new bucket needs provisioning.
 */

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase } from '../../../../lib/supabase';
import { buildAgreementHtml, type DrawnSignature } from '../buildAgreementHtml';
import type { AgreementType, MerchantAgreementData } from '../content/types';
import { AGREEMENT_VERSION } from '../content';

const BUCKET = 'merchant-docs';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getApiUrl = (): string => process.env.EXPO_PUBLIC_API_URL as string;

/** Shift an epoch to IST (UTC+5:30) wall-clock and read its UTC fields. */
function toIst(d: Date): Date {
  return new Date(d.getTime() + 5.5 * 3600 * 1000);
}
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14 June 2026" in IST. */
export function formatAcceptanceDate(d: Date): string {
  const i = toIst(d);
  return `${i.getUTCDate()} ${MONTHS[i.getUTCMonth()]} ${i.getUTCFullYear()}`;
}

/** "14 June 2026, 21:42:07 IST". */
export function formatSignedAt(d: Date): string {
  const i = toIst(d);
  return `${i.getUTCDate()} ${MONTHS[i.getUTCMonth()]} ${i.getUTCFullYear()}, ${pad2(i.getUTCHours())}:${pad2(i.getUTCMinutes())}:${pad2(i.getUTCSeconds())} IST`;
}

export interface SignAgreementArgs {
  type: AgreementType;
  merchant: MerchantAgreementData;
  userId: string;
  signature: DrawnSignature;
  accepted: { privacy: boolean; terms: boolean; partner: boolean };
  signedAt: Date;
}

export interface SignAgreementResult {
  consentId: string | null;
  pdfPath: string;
  pdfUri: string;
}

export async function signAndPersistAgreement(args: SignAgreementArgs): Promise<SignAgreementResult> {
  const { type, merchant, userId, signature, accepted, signedAt } = args;

  const device = `${Platform.OS} · v${String(Platform.Version)} · PAS Partner`;
  const html = buildAgreementHtml({
    type,
    merchant,
    signature,
    audit: {
      signedAtDisplay: formatSignedAt(signedAt),
      device,
      acceptedPrivacy: accepted.privacy,
      acceptedTerms: accepted.terms,
      acceptedPartner: accepted.partner,
    },
  });

  // 1. Render the PDF locally.
  const { uri } = await Print.printToFileAsync({ html });

  // 2. Upload to the private merchant-docs bucket.
  const pdfPath = `agreements/${userId}/agreement-${signedAt.getTime()}.pdf`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, decode(base64), { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Could not upload the signed agreement (${upErr.message}).`);

  // 3. Persist the consent record (server stamps IP + doc hash).
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Your session expired. Please restart signup and try again.');

  const resp = await fetch(`${getApiUrl()}/merchant-signup/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      agreementType: type,
      agreementVersion: AGREEMENT_VERSION,
      acceptedPrivacy: accepted.privacy,
      acceptedTerms: accepted.terms,
      acceptedPartner: accepted.partner,
      signatoryName: merchant.signatoryName,
      designation: merchant.designation,
      signature,
      signedPdfPath: pdfPath,
      signedAtIso: signedAt.toISOString(),
      device,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Could not record your consent (${resp.status}). ${body}`.trim());
  }
  const json: { consentId?: string } = await resp.json().catch(() => ({}));
  return { consentId: json.consentId ?? null, pdfPath, pdfUri: uri };
}
