import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { ADMIN_CONFIG } from '@/config/admin';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

const BLOB_STORE_PREFIX = 'auth-accounts';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Admin only - list all registered accounts
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Auth check via withAuth middleware (user is already authenticated)
    const allowedAdmins = ADMIN_CONFIG.adminEmails;
    
    if (!allowedAdmins.includes(user.email)) {
      console.warn('⚠️ Unauthorized access attempt to list-accounts:', user.email);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    console.log('✅ Authorized admin access:', user.email);
    
    console.log('📊 GET /api/auth/list-accounts - Fetching all accounts');
    console.log('🔍 Looking for blobs with prefix:', BLOB_STORE_PREFIX);
    
    // List all auth accounts from Blob Storage
    const { blobs } = await list({
      prefix: BLOB_STORE_PREFIX,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    
    console.log(`✅ Found ${blobs.length} account blob(s) in Blob Storage`);
    console.log('📋 Blob pathnames:', blobs.map(b => b.pathname));
    
    // Fetch each account's data (without password)
    const accounts = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url);
          const data = await response.json();
          
          // Return account info without password
          return {
            email: data.email,
            name: data.name,
            company: data.company,
            phone: data.phone,
            createdAt: data.createdAt,
            isGuest: data.isGuest || false
          };
        } catch (error) {
          console.error(`Error fetching blob ${blob.pathname}:`, error);
          return null;
        }
      })
    );
    
    // Filter out nulls and sort by creation date
    const validAccounts = accounts
      .filter(a => a !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return NextResponse.json({
      success: true,
      count: validAccounts.length,
      accounts: validAccounts
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/auth/list-accounts:', error);
    return NextResponse.json(
      { error: 'Failed to list accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });
