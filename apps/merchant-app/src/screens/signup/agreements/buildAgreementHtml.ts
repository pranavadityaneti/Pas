/**
 * Signed-agreement HTML builder — Phase 0.2 (2026-06-14).
 *
 * Produces the full HTML for the personalized, signed vendor agreement PDF
 * (rendered to PDF via expo-print). Composition:
 *   1. Title + Merchant Details header (Aadhaar masked to last 4)
 *   2. Personalized parties recital + per-type binding clause
 *   3. All fixed legal sections (from the content registry)
 *   4. Execution block — PAS "accepted electronically" + the merchant's drawn
 *      signature (inline SVG) + an electronic-signature audit record
 *
 * The same MerchantAgreementData + content drive the in-app read view (0.3),
 * so what the merchant reads is what they sign.
 */

import type { AgreementType, MerchantAgreementData, Section } from './content/types';
import { getAgreementBody, AGREEMENT_VERSION, AGREEMENT_VARIANT_LABEL } from './content';

/** Drawn-signature capture from the SignaturePad (vector, no rasterization). */
export interface DrawnSignature {
  /** SVG path `d` strings, one per stroke. */
  paths: string[];
  /** Capture viewBox dimensions the paths were drawn in. */
  width: number;
  height: number;
}

export interface AgreementAudit {
  /** e.g. "14 June 2026, 21:42:07 IST" */
  signedAtDisplay: string;
  ip?: string;
  /** e.g. "iPhone 13 · iOS 18.2 · PAS Partner v1.2.4" */
  device?: string;
  /** SHA-256 hex of the rendered document body. */
  docHash?: string;
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
  acceptedPartner: boolean;
}

export interface SignedAgreementInput {
  type: AgreementType;
  merchant: MerchantAgreementData;
  signature: DrawnSignature;
  audit: AgreementAudit;
}

/** HTML-escape a merge value. */
function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mask an Aadhaar number to the last 4 digits (UIDAI-compliant display). */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  const digits = (aadhaar ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/** Render a clause's text (handles \n\n paragraphs and \n line breaks) to HTML. */
function renderText(text: string): string {
  return text
    .split('\n\n')
    .map((para) => `<p class="cl-text">${esc(para).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function renderSection(s: Section): string {
  const clauses = s.clauses
    .map((c) => {
      const num = c.n ? `<span class="cl-n">${esc(c.n)}</span>` : '';
      const title = c.title ? `<span class="cl-title">${esc(c.title)}</span>` : '';
      const head = c.n || c.title ? `<div class="cl-head">${num}${title}</div>` : '';
      const body = c.text ? renderText(c.text) : '';
      const bullets = c.bullets && c.bullets.length
        ? `<ul class="cl-bullets">${c.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
        : '';
      return `<div class="clause">${head}${body}${bullets}</div>`;
    })
    .join('');
  return `<section class="sec"><h2 class="sec-h">${esc(s.n)}. ${esc(s.title)}</h2>${clauses}</section>`;
}

function renderSignatureSvg(sig: DrawnSignature): string {
  if (!sig.paths.length) return '<div class="sig-empty">[no signature captured]</div>';
  const paths = sig.paths
    .map((d) => `<path d="${esc(d)}" fill="none" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  return `<svg class="sig-svg" viewBox="0 0 ${sig.width} ${sig.height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function row(label: string, value: string): string {
  return `<tr><td class="k">${esc(label)}</td><td class="v">${value}</td></tr>`;
}

function acceptedList(a: AgreementAudit): string {
  const parts: string[] = [];
  if (a.acceptedPrivacy) parts.push('Privacy Policy');
  if (a.acceptedTerms) parts.push('Terms of Service');
  if (a.acceptedPartner) parts.push('Partner Agreement');
  return parts.length ? parts.join(', ') : '—';
}

export function buildAgreementHtml(input: SignedAgreementInput): string {
  const { type, merchant: m, signature, audit } = input;
  const body = getAgreementBody(type);
  const variant = AGREEMENT_VARIANT_LABEL[type];

  const recital =
    `This Merchant Agreement ("Agreement") is entered into between ` +
    `<strong>PAS RETAIL NETWORKS Private Limited</strong>, a company incorporated under the ` +
    `Companies Act, 2013, having its registered office in India ("Pick At Store", "PAS", ` +
    `"Platform", "Company", "We", "Us", "Our"), and <strong>${esc(m.businessName)}</strong>, ` +
    `having its principal place of business at ${esc(m.placeOfBusiness)}, acting through its ` +
    `authorised signatory ${esc(m.signatoryName)} (${esc(m.designation)}) ("Merchant", "You", "Your").`;

  const detailRows = [
    row('Merchant / business name', esc(m.businessName)),
    row('Store category', esc(m.storeCategory)),
    row('Authorised signatory', `${esc(m.signatoryName)} — ${esc(m.designation)}`),
    row('Principal place of business', esc(m.placeOfBusiness)),
    row('PAN', esc(m.pan)),
    row('Aadhaar (masked)', `<span class="mono">${esc(maskAadhaar(m.aadhaar))}</span>`),
    m.gstin ? row('GSTIN', esc(m.gstin)) : '',
    row('FSSAI licence', m.fssai ? esc(m.fssai) : '—'),
    row('Contact', `${esc(m.phone)} · ${esc(m.email)}`),
    row('Merchant ID', `<span class="mono">${esc(m.merchantId)}</span>`),
    row('Date of acceptance', esc(m.acceptanceDate)),
  ].join('');

  const auditRows = [
    row('Signed by', `${esc(m.signatoryName)} (${esc(m.designation)}), ${esc(m.businessName)}`),
    row('Acceptance method', `On-screen drawn signature + accepted ${esc(acceptedList(audit))}`),
    row('Date &amp; time', esc(audit.signedAtDisplay)),
    audit.ip ? row('IP address', `<span class="mono">${esc(audit.ip)}</span>`) : '',
    audit.device ? row('Device', esc(audit.device)) : '',
    row('Merchant ID', `<span class="mono">${esc(m.merchantId)}</span>`),
    row('Document', `Merchant Agreement (${esc(variant)}) ${esc(AGREEMENT_VERSION)}`),
    audit.docHash ? row('Document hash (SHA-256)', `<span class="mono break">${esc(audit.docHash)}</span>`) : '',
  ].join('');

  const sections = body.sections.map(renderSection).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 40px 44px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.55; margin: 0; }
  .title { text-align: center; margin: 0 0 4px; }
  .title h1 { font-size: 17px; letter-spacing: 0.5px; margin: 0; }
  .title .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .details { background: #FFFBEF; border: 1px solid #F0D98A; border-radius: 6px; padding: 12px 14px; margin: 16px 0 18px; }
  .details .lbl { font-size: 10px; font-weight: bold; color: #7a5b00; letter-spacing: 1px; margin-bottom: 8px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 2.5px 0; vertical-align: top; }
  table.kv td.k { color: #6b7280; width: 36%; padding-right: 10px; }
  table.kv td.v { color: #1f2937; }
  .recital p { margin: 0 0 10px; }
  .sec { margin: 14px 0 0; }
  .sec-h { font-size: 12px; font-weight: bold; margin: 14px 0 6px; }
  .clause { margin: 0 0 7px; }
  .cl-head { margin-bottom: 2px; }
  .cl-n { font-weight: bold; margin-right: 6px; }
  .cl-title { font-weight: bold; }
  .cl-text { margin: 0 0 5px; }
  .cl-bullets { margin: 4px 0 6px 18px; padding: 0; }
  .cl-bullets li { margin: 1px 0; }
  .mono { font-family: 'Courier New', monospace; }
  .break { word-break: break-all; }
  .exec { margin-top: 22px; page-break-inside: avoid; }
  .exec-h { font-size: 12px; font-weight: bold; margin: 0 0 10px; }
  .sig-cols { display: flex; gap: 28px; margin: 18px 0; }
  .sig-col { flex: 1; }
  .sig-col .role { font-size: 10px; color: #6b7280; margin-bottom: 6px; }
  .sig-col .name { font-size: 12px; font-weight: bold; margin-bottom: 8px; }
  .sig-box { border: 1px solid #e5e7eb; border-radius: 6px; height: 78px; }
  .sig-box.dashed { border-style: dashed; border-color: #cbd5e1; background: #fafafa; text-align: center; }
  .sig-box.dashed .stamp { font-size: 11px; color: #1d9e75; padding-top: 26px; font-weight: bold; }
  .sig-svg { width: 100%; height: 78px; }
  .sig-empty { font-size: 10px; color: #9ca3af; padding: 30px 0; text-align: center; }
  .sig-meta { font-size: 10px; color: #6b7280; margin-top: 6px; }
  .audit { background: #F8FAFC; border: 1px solid #e5e7eb; border-radius: 6px; padding: 13px 15px; margin-top: 4px; }
  .audit .lbl { font-size: 10px; font-weight: bold; color: #6b7280; letter-spacing: 1px; margin-bottom: 9px; }
  .audit .note { font-size: 10px; color: #9ca3af; margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style></head><body>
  <div class="title"><h1>MERCHANT AGREEMENT</h1><div class="sub">PAS Retail Networks Private Limited · ${esc(variant)}</div></div>

  <div class="details">
    <div class="lbl">MERCHANT DETAILS</div>
    <table class="kv">${detailRows}</table>
  </div>

  <div class="recital"><p>${recital}</p><p>${esc(body.bindingClause)}</p></div>

  ${sections}

  <div class="exec">
    <div class="exec-h">EXECUTION</div>
    <p>IN WITNESS WHEREOF, the parties have caused this Agreement to be executed electronically as of the date of acceptance recorded below, and the Merchant confirms having read, understood, and accepted all terms herein.</p>
    <div class="sig-cols">
      <div class="sig-col">
        <div class="role">For and on behalf of</div>
        <div class="name">PAS Retail Networks Pvt. Ltd.</div>
        <div class="sig-box dashed"><div class="stamp">✓ Accepted electronically</div></div>
        <div class="sig-meta">Authorised Signatory · Pick At Store</div>
      </div>
      <div class="sig-col">
        <div class="role">For and on behalf of the Merchant</div>
        <div class="name">${esc(m.businessName)}</div>
        <div class="sig-box">${renderSignatureSvg(signature)}</div>
        <div class="sig-meta">${esc(m.signatoryName)} · ${esc(m.designation)} · Authorised Signatory</div>
      </div>
    </div>
    <div class="audit">
      <div class="lbl">ELECTRONIC SIGNATURE — AUDIT RECORD</div>
      <table class="kv">${auditRows}</table>
      <div class="note">This Agreement was executed electronically in accordance with the Information Technology Act, 2000. The audit record above forms part of and evidences this Agreement.</div>
    </div>
  </div>
</body></html>`;
}
