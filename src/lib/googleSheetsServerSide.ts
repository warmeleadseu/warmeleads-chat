/**
 * Server-side only Google Sheets operations using Service Account
 * This file should ONLY be imported in API routes (server-side)
 */

import { Lead } from './crmSystem';

// Service Account credentials
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "warmeleads-spreadsheet-api",
  private_key_id: "d0672037a6e9080a645cee5e63313eff70402ed2",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxXMg9rc1P0JT9\nk0JMS9KfU2GLmyOm4Z9aIuULZSIiZrOmiEwtP2kfX+gfyoGMX0DTuEmdr0Fd0Wcc\nFj4QeXQ7UJgnJdLw2XJVFaQUAok3f52vjXhxGHlea77TEisHb9NN9uYSSmK8VD5B\nyAgMSdNO5/Vcn/V0KJspksg3vp3VJho3S15TR0d/AgsKSDiGu5dB0RbIEI4aVZmJ\ny59KHV2Wxhgb0oNSsmNavKqaa/TScWm60AOMmo1enEOivb+BdxOD6rXzLDwj3kv0\nY94G46ZCStUCK9Qmyg64IH8JIq/mHW8eS2oGVKoPUPtdNUcWvM8UaE/Zd2huC3xB\nVOvQgpjPAgMBAAECggEAFgk3jcY+yIhbQogdyBnxkL8M0woS62SD5nCIcZp+m7ST\n5IBxqnuC5ZWGYxDHeLfK96Mhblh8cBoYy/oNewGECeyRAuglpav2kxCtwpiwELen\n0Uxr5u1KAwuy+Ul8FB/2Km0fF62rR8fVtlmSemhfuyGBsCDln6l94bPtcVObC4TL\n1ldL6kFBWQ1u6g0DRYpTTZOTDYXu8QpWI8Pf/B1M+iK3cf07X5W9J2AbAFasWG/l\nFGeaIqZLGw91LN2HZNb6MmqE9ECiLu7JkLcSt/Y1qH5RhmgEZPsQVaS46KnjTry6\n3xF8TZ3P+ZwRfngxr8/tar2/Y+tehj/K8aINY/tJUQKBgQDi5M5fdhdeaDVT2+M3\nbIvTcMmGPMk8an/uN4XKuZteO7/x+/p0CDV/DETN2Xb+EBQUzR1UvHEGiHWrtHor\nD/cgsol3HJwVx+ZIFgiEJdDW8MQPGI3B9g3pstYOjTc5V+2DEBuzUEWFQlkg48K8\nMqchwkDNOUx8nsmhUPhGkoP9PwKBgQDIHV3AfEimiWO5CWRZgoRf81WcPJWzNuhi\n1VRxKtZxP7ZaCoGis/stvygaXLR9jf5l8Z9MghVRiN6KlwsG45VzybuvxxeERLRD\nFB1mlHDX0Qw4MJeFp1v5vK2pjRutXfkKSpJEMBb8MskBLQLMyfheJlZqIPAJK7pb\nzEjedjwwcQKBgFNjMA2ZgyEpP2AgkjNOa108OHRjZroTkgzkzwEgkd9iKjsvFm8K\njU6yHZ9h6v+YvSif8cWwtAFoqYZ/f97PsU2NEER8eUjv/MxFfL/Efipgtk2uAntk\niNx4437Zm5AxppLimqueNs6xAby6uFkebJpVoCdMhbXPTd9BuN2G/4dVAoGBAJgP\n+JWz22DxNZ39zQtXak+fEIbQYtD0AFJZ2PjFnH4h8+cn5KpGKa/xef/OQjjGFXJR\n0MLKdnimkLSvYemyNnbt7Hj9yJjxvCjcuBqi4bydVbO8+ObO7c0v2qbkWwu6ROvV\nDqBSCqVJ0gPauC31q42fhDrRHJVbbRkkeprRLZuBAoGBAKdsekLRmSn668kDQGSW\nwa4C2BwbIN5qAp6kaswbiFMLRjomcpkkFSVGaqFIvBCv481kStnsBVOTJ7FiFaHf\nXFB7zKjQDh9CBjIFeTIMUuwlWjwVGQthly2CaW0J+jqeIFv6ENLAWWF+DGdILzDc\nz5kcOWJ0mtJL+coLiKeoUGTx\n-----END PRIVATE KEY-----\n",
  client_email: "warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com",
  client_id: "113186755880801911650",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_uri: "https://accounts.google.com/o/oauth2/auth"
};

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth2 access token from Google using JWT Bearer flow
 * Server-side only - uses Node.js crypto
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('✅ Using cached access token');
    return cachedToken;
  }

  try {
    console.log('🔑 Getting new OAuth2 access token...');
    
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const jwtClaims = {
      iss: SERVICE_ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: SERVICE_ACCOUNT.token_uri,
      exp: now + 3600,
      iat: now
    };

    // Encode JWT header and claims
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify(jwtClaims)).toString('base64url');
    const unsignedToken = `${header}.${claims}`;

    // Sign with private key (Node.js only)
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    sign.end();
    const signature = sign.sign(SERVICE_ACCOUNT.private_key, 'base64url');
    
    const jwt = `${unsignedToken}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch(SERVICE_ACCOUNT.token_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OAuth2 error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`OAuth2 error: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    cachedToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minute buffer

    console.log('✅ OAuth2 access token obtained successfully');
    return cachedToken!;

  } catch (error) {
    console.error('❌ Error getting access token:', error);
    throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract spreadsheet ID from Google Sheets URL
 */
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Update a lead in Google Sheets (server-side only)
 */
export async function updateLeadInSheetServerSide(
  spreadsheetUrl: string,
  lead: Lead
): Promise<boolean> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  
  if (!spreadsheetId) {
    throw new Error('Invalid spreadsheet URL');
  }

  if (!lead.sheetRowNumber) {
    throw new Error('Lead is missing sheetRowNumber');
  }

  console.log(`🔄 Server-side: Updating lead ${lead.name} in row ${lead.sheetRowNumber}`);

  // Convert lead to row format (matching your spreadsheet structure)
  const rowData = [
    lead.name, // A - Naam Klant
    lead.branchData?.datumInteresse || '', // B - Datum Interesse Klant
    lead.branchData?.postcode || '', // C - Postcode
    lead.branchData?.huisnummer || '', // D - Huisnummer
    lead.city || '', // E - Plaatsnaam
    lead.phone || '', // F - Telefoonnummer
    lead.email || '', // G - E-mail
    lead.branchData?.zonnepanelen || '', // H - Zonnepanelen
    lead.branchData?.dynamischContract || '', // I - Dynamisch contract
    lead.branchData?.stroomverbruik || '', // J - Stroomverbruik
    lead.budget || '', // K - Budget
    lead.branchData?.nieuwsbrief || '', // L - Nieuwsbrief
    lead.branchData?.redenThuisbatterij || '', // M - Reden Thuisbatterij
    lead.branchData?.koopintentie || '', // N - Koopintentie?
    lead.notes || '', // O - Notities
    lead.status || 'new', // P - Status
    lead.dealValue ? lead.dealValue.toString() : '', // Q - DealValue (omzet)
    lead.profit ? lead.profit.toString() : '' // R - Profit (winst)
  ];

  console.log(`📊 Server-side: Row data for ${lead.name}:`, rowData);

  // Get access token
  const accessToken = await getAccessToken();

  // Update the sheet
  const range = `A${lead.sheetRowNumber}:R${lead.sheetRowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  console.log(`📝 Server-side: PUT request to Google Sheets`, {
    spreadsheetId: spreadsheetId.substring(0, 10) + '...',
    range,
    url
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowData],
      majorDimension: 'ROWS'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Server-side: Google Sheets update failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to update Google Sheets: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Server-side: Google Sheets update successful:', data);
  
  return true;
}

