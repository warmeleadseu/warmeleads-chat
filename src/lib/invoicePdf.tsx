import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const BRAND = '#7C3AED';
const BRAND_LIGHT = '#F5F3FF';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#1E293B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logoImage: { width: 130, height: 'auto' as unknown as number },
  logoFallback: { fontSize: 22, fontWeight: 700, color: BRAND, fontFamily: 'Helvetica-Bold' },
  invoiceTitle: { fontSize: 24, fontWeight: 700, color: '#0F172A', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  invoiceMeta: { textAlign: 'right', marginTop: 4, fontSize: 9, color: '#64748B' },

  row2col: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  colHalf: { width: '48%' },
  label: { fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  value: { fontSize: 9.5, lineHeight: 1.5 },

  table: { marginTop: 8, marginBottom: 24 },
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND_LIGHT, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 7, paddingHorizontal: 10 },
  colDesc: { width: '50%' },
  colQty: { width: '15%', textAlign: 'right' },
  colUnit: { width: '17.5%', textAlign: 'right' },
  colTotal: { width: '17.5%', textAlign: 'right' },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },

  totalsBox: { alignSelf: 'flex-end', width: 220, marginTop: 4 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsLabel: { color: '#64748B', fontSize: 9 },
  totalsValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  totalsFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 2, borderTopColor: BRAND, marginTop: 4 },
  totalsFinalLabel: { color: BRAND, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  totalsFinalValue: { color: BRAND, fontSize: 11, fontFamily: 'Helvetica-Bold' },

  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: '#94A3B8' },
});

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceData {
  invoice_number: string;
  created_at: string;
  paid_at: string | null;

  logo_url?: string;
  company_name: string;
  company_address: string;
  company_postcode: string;
  company_city: string;
  company_kvk: string;
  company_btw: string;
  company_iban: string;
  company_email: string;

  customer_name: string;
  customer_email: string;
  customer_address: string | null;
  customer_vat_id: string | null;

  description: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  btw_percentage: number;
  btw_amount: number;
  total_incl_btw: number;
  mollie_payment_id: string | null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function eur(n: number): string {
  return `€ ${n.toFixed(2).replace('.', ',')}`;
}

export function InvoicePdf({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            {data.logo_url ? (
              <Image src={data.logo_url} style={s.logoImage} />
            ) : (
              <Text style={s.logoFallback}>{data.company_name}</Text>
            )}
            <Text style={{ ...s.value, marginTop: 4, color: '#64748B', fontSize: 8 }}>
              {[data.company_address, `${data.company_postcode} ${data.company_city}`.trim()].filter(Boolean).join('\n')}
            </Text>
          </View>
          <View>
            <Text style={s.invoiceTitle}>FACTUUR</Text>
            <Text style={s.invoiceMeta}>{data.invoice_number}</Text>
          </View>
        </View>

        {/* From / To */}
        <View style={s.row2col}>
          <View style={s.colHalf}>
            <Text style={s.label}>Van</Text>
            <Text style={s.value}>{data.company_name}</Text>
            {data.company_address ? <Text style={s.value}>{data.company_address}</Text> : null}
            {(data.company_postcode || data.company_city) ? (
              <Text style={s.value}>{`${data.company_postcode} ${data.company_city}`.trim()}</Text>
            ) : null}
            {data.company_kvk ? <Text style={s.value}>KvK: {data.company_kvk}</Text> : null}
            {data.company_btw ? <Text style={s.value}>BTW: {data.company_btw}</Text> : null}
            {data.company_iban ? <Text style={s.value}>IBAN: {data.company_iban}</Text> : null}
            <Text style={s.value}>{data.company_email}</Text>
          </View>
          <View style={s.colHalf}>
            <Text style={s.label}>Aan</Text>
            <Text style={s.value}>{data.customer_name}</Text>
            {data.customer_address ? <Text style={s.value}>{data.customer_address}</Text> : null}
            <Text style={s.value}>{data.customer_email}</Text>
            {data.customer_vat_id ? <Text style={s.value}>BTW: {data.customer_vat_id}</Text> : null}
          </View>
        </View>

        {/* Invoice details */}
        <View style={{ ...s.row2col, marginBottom: 16 }}>
          <View style={s.colHalf}>
            <Text style={s.label}>Factuurdatum</Text>
            <Text style={s.value}>{fmtDate(data.created_at)}</Text>
          </View>
          <View style={s.colHalf}>
            <Text style={s.label}>Betaaldatum</Text>
            <Text style={s.value}>{data.paid_at ? fmtDate(data.paid_at) : 'In afwachting'}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <View style={s.colDesc}><Text style={s.thText}>Omschrijving</Text></View>
            <View style={s.colQty}><Text style={s.thText}>Aantal</Text></View>
            <View style={s.colUnit}><Text style={s.thText}>Prijs</Text></View>
            <View style={s.colTotal}><Text style={s.thText}>Totaal</Text></View>
          </View>
          {data.line_items.map((item, i) => (
            <View key={i} style={s.tableRow}>
              <View style={s.colDesc}><Text>{item.description}</Text></View>
              <View style={s.colQty}><Text>{item.quantity}</Text></View>
              <View style={s.colUnit}><Text>{eur(item.unit_price)}</Text></View>
              <View style={s.colTotal}><Text>{eur(item.total)}</Text></View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsBox}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotaal excl. BTW</Text>
            <Text style={s.totalsValue}>{eur(data.subtotal)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>BTW {data.btw_percentage}%</Text>
            <Text style={s.totalsValue}>{eur(data.btw_amount)}</Text>
          </View>
          <View style={s.totalsFinal}>
            <Text style={s.totalsFinalLabel}>Totaal incl. BTW</Text>
            <Text style={s.totalsFinalValue}>{eur(data.total_incl_btw)}</Text>
          </View>
        </View>

        {/* Payment ref */}
        {data.mollie_payment_id && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 8, color: '#94A3B8' }}>
              Betaalreferentie: {data.mollie_payment_id}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.company_name} | {data.company_email}</Text>
          <Text style={s.footerText}>{data.invoice_number}</Text>
          {data.company_kvk ? <Text style={s.footerText}>KvK {data.company_kvk}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
