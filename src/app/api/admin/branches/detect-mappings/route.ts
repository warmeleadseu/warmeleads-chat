/**
 * API Route: Google Spreadsheet Load & Auto-Detection
 * POST: Load Google Spreadsheet and detect column mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { columnDetector } from '@/lib/branchSystem';

/**
 * Extract spreadsheet ID from Google Sheets URL
 */
function extractSpreadsheetId(url: string): string | null {
  try {
    // Match patterns like:
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Service Account credentials (same as /api/sheets-auth)
 */
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

/**
 * Get Service Account access token
 */
async function getServiceAccountToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: SERVICE_ACCOUNT.private_key_id
  };

  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: SERVICE_ACCOUNT.token_uri,
    exp: exp,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const privateKeyPem = SERVICE_ACCOUNT.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`OAuth2 token exchange failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spreadsheetUrl } = body;

    if (!spreadsheetUrl) {
      return NextResponse.json(
        { error: 'Google Spreadsheet URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!spreadsheetUrl.includes('docs.google.com/spreadsheets')) {
      return NextResponse.json(
        { error: 'Invalid Google Spreadsheet URL' },
        { status: 400 }
      );
    }

    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Could not extract spreadsheet ID from URL' },
        { status: 400 }
      );
    }

    console.log('📊 Loading Google Spreadsheet:', {
      url: spreadsheetUrl,
      spreadsheetId: spreadsheetId.substring(0, 10) + '...'
    });

    // Get Service Account access token
    const accessToken = await getServiceAccountToken();
    
    // First, get spreadsheet metadata to find the first sheet name
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataResponse = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('❌ Google Sheets metadata error:', {
        status: metadataResponse.status,
        statusText: metadataResponse.statusText,
        error: errorText
      });
      
      if (metadataResponse.status === 403) {
        return NextResponse.json(
          { error: 'Geen toegang tot spreadsheet. Zorg dat de sheet gedeeld is met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com of "Iedereen met de link kan bekijken" heeft.' },
          { status: 403 }
        );
      } else if (metadataResponse.status === 404) {
        return NextResponse.json(
          { error: 'Spreadsheet niet gevonden. Controleer de URL.' },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          { error: `Google Sheets API error: ${metadataResponse.status} - ${metadataResponse.statusText}. Details: ${errorText}` },
          { status: metadataResponse.status }
        );
      }
    }

    const metadata = await metadataResponse.json();
    const firstSheet = metadata.sheets?.[0];
    
    if (!firstSheet) {
      return NextResponse.json(
        { error: 'Spreadsheet heeft geen sheets.' },
        { status: 400 }
      );
    }

    const sheetName = firstSheet.properties?.title || 'Sheet1';
    console.log('📋 Found sheet:', sheetName);

    // Read spreadsheet data using Service Account (use A1 notation without sheet name, or with proper encoding)
    const range = `${sheetName}!A1:Z1000`;
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
    
    console.log('📊 Reading range:', range);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error('❌ Google Sheets API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        url: url.substring(0, 100) + '...'
      });
      
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Geen toegang tot spreadsheet. Zorg dat de sheet gedeeld is met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com of "Iedereen met de link kan bekijken" heeft.' },
          { status: 403 }
        );
      } else if (response.status === 404) {
        return NextResponse.json(
          { error: 'Spreadsheet niet gevonden. Controleer de URL.' },
          { status: 404 }
        );
      } else if (response.status === 400) {
        // Try without range, just get all data from first sheet
        console.log('⚠️ Range error, trying without range...');
        const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const rows = fallbackData.values || [];
          
          if (rows.length === 0) {
            return NextResponse.json(
              { error: 'Spreadsheet is leeg.' },
              { status: 400 }
            );
          }
          
          const headers = rows[0] as string[];
          const detectedMappings = await columnDetector.detectColumnMappings(headers);
          
          return NextResponse.json({
            spreadsheetData: {
              headers,
              totalRows: rows.length - 1,
              totalColumns: headers.length,
              sampleRows: rows.slice(1, 6)
            },
            detectedMappings: detectedMappings.map(m => ({
              columnIndex: m.columnIndex,
              columnLetter: m.columnLetter,
              headerName: m.headerName,
              fieldKey: m.detectedFieldKey,
              fieldLabel: m.detectedFieldLabel,
              fieldType: m.detectedFieldType,
              confidence: m.confidence,
              suggestion: m.suggestion,
              isRequired: columnDetector.isFieldRequired(m.detectedFieldKey),
              isUnique: columnDetector.isFieldUnique(m.detectedFieldKey),
              showInList: columnDetector.shouldShowInList(m.detectedFieldKey, m.columnIndex),
              showInDetail: true,
              includeInEmail: columnDetector.shouldIncludeInEmail(m.detectedFieldKey),
              emailPriority: columnDetector.getEmailPriority(m.detectedFieldKey),
              sortOrder: m.columnIndex
            }))
          });
        }
        
        return NextResponse.json(
          { error: `Ongeldige range of sheet naam. Fout: ${errorDetails.error?.message || errorText}` },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: `Google Sheets API error: ${response.status} - ${response.statusText}. Details: ${errorText}` },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    const rows = data.values || [];
    
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Spreadsheet is empty or inaccessible. Make sure the spreadsheet is shared correctly.' },
        { status: 400 }
      );
    }

    // Extract headers (first row)
    const headers = rows[0] as string[];
    
    console.log('✅ Spreadsheet loaded successfully:', {
      rows: rows.length,
      columns: headers.length,
      headers: headers.slice(0, 5)
    });
    
    // Auto-detect mappings
    const detectedMappings = await columnDetector.detectColumnMappings(headers);

    // Build response
    return NextResponse.json({
      spreadsheetData: {
        headers,
        totalRows: rows.length - 1, // Exclude header row
        totalColumns: headers.length,
        sampleRows: rows.slice(1, 6) // First 5 data rows
      },
      detectedMappings: detectedMappings.map(m => ({
        columnIndex: m.columnIndex,
        columnLetter: m.columnLetter,
        headerName: m.headerName,
        fieldKey: m.detectedFieldKey,
        fieldLabel: m.detectedFieldLabel,
        fieldType: m.detectedFieldType,
        confidence: m.confidence,
        suggestion: m.suggestion,
        isRequired: columnDetector.isFieldRequired(m.detectedFieldKey),
        isUnique: columnDetector.isFieldUnique(m.detectedFieldKey),
        showInList: columnDetector.shouldShowInList(m.detectedFieldKey, m.columnIndex),
        showInDetail: true,
        includeInEmail: columnDetector.shouldIncludeInEmail(m.detectedFieldKey),
        emailPriority: columnDetector.getEmailPriority(m.detectedFieldKey),
        sortOrder: m.columnIndex
      }))
    });
  } catch (error: any) {
    console.error('❌ Error processing Google Spreadsheet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Google Spreadsheet. Check if the spreadsheet is shared correctly.' },
      { status: 500 }
    );
  }
}
