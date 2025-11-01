import { NextRequest, NextResponse } from 'next/server';
import { createHash, createSign } from 'crypto';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const { unsignedToken, privateKey } = await req.json();
    
    if (!unsignedToken || !privateKey) {
      return NextResponse.json({ error: 'Missing unsignedToken or privateKey' }, { status: 400 });
    }

    // Sign the JWT using the private key
    const sign = createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const signedToken = `${unsignedToken}.${signature}`;
    
    console.log('✅ JWT signed successfully');
    
    return NextResponse.json({ signedToken });
    
  } catch (error) {
    console.error('JWT signing error:', error);
    return NextResponse.json({ 
      error: 'JWT signing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});






