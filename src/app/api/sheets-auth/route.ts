import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

/**
 * Server-side Google Sheets Service Account Authentication
 * This endpoint handles OAuth2 token generation for the Service Account
 * 
 * AUTHENTICATED - Service account, but still requires auth for tracking/logging
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

// Cache for access token
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get or refresh OAuth2 access token for Google Sheets API (AUTHENTICATED)
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log('🔑 GET /api/sheets-auth - Requesting Service Account token');
    
    // Check if we have a valid cached token
    if (cachedToken && Date.now() < tokenExpiry) {
      console.log('✅ Returning cached token');
      return NextResponse.json({ 
        access_token: cachedToken,
        expires_in: Math.floor((tokenExpiry - Date.now()) / 1000)
      });
    }

    // Generate new JWT
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

    // For server-side, we need to use a crypto library to sign the JWT
    // Since we can't use node:crypto in Edge Runtime, we'll use Web Crypto API
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

    console.log('🔑 JWT generated, exchanging for access token...');

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
      console.error('❌ OAuth2 token exchange failed:', errorText);
      return NextResponse.json(
        { error: 'OAuth2 token exchange failed', details: errorText },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Cache the token
    cachedToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minute buffer

    console.log('✅ Access token obtained and cached');

    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type || 'Bearer'
    });

  } catch (error) {
    console.error('❌ Error in GET /api/sheets-auth:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get access token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}





