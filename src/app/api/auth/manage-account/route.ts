import { NextRequest, NextResponse } from 'next/server';
import { put, del, list } from '@vercel/blob';
import { isAdminEmail } from '@/config/admin';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Manage account: activate, deactivate, or delete (ADMIN ONLY)
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { action, email, adminEmail } = await request.json();

    // Verify admin via withAuth (user is already authenticated)
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
    }

    console.log(`🔧 Account management: ${action} for ${email}`);

    // Get all users from Blob Storage (use correct prefix!)
    const { blobs } = await list({ 
      prefix: 'auth-accounts/',
      token: process.env.BLOB_READ_WRITE_TOKEN 
    });
    
    console.log(`📦 Found ${blobs.length} accounts in Blob Storage`);
    console.log('📋 Looking for:', `auth-accounts/${email.replace('@', '_at_').replace(/\./g, '_dot_')}.json`);
    
    if (action === 'delete') {
      // Find and delete the user blob - use consistent formatting
      const emailPath = `auth-accounts/${email.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
      const userBlob = blobs.find(blob => blob.pathname === emailPath);
      
      if (userBlob) {
        await del(userBlob.url);
        console.log(`✅ Deleted account: ${email}`);
        return NextResponse.json({ 
          success: true, 
          message: `Account ${email} verwijderd` 
        });
      } else {
        console.warn(`⚠️ Account not found in Blob Storage: ${email}`);
        return NextResponse.json({ 
          success: false, 
          message: 'Account niet gevonden in Blob Storage' 
        }, { status: 404 });
      }
    }

    if (action === 'activate' || action === 'deactivate') {
      // Find the user blob - use consistent formatting
      const emailPath = `auth-accounts/${email.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
      const userBlob = blobs.find(blob => blob.pathname === emailPath);
      
      if (!userBlob) {
        return NextResponse.json({ 
          error: 'Account niet gevonden' 
        }, { status: 404 });
      }

      // Fetch current user data
      const userResponse = await fetch(userBlob.url);
      const userData = await userResponse.json();

      // Update active status
      const updatedUser = {
        ...userData,
        isActive: action === 'activate',
        updatedAt: new Date().toISOString()
      };

      // Save back to Blob Storage with correct path (reuse emailPath from above)
      const blob = await put(emailPath, JSON.stringify(updatedUser), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      console.log(`✅ Account ${action}d: ${email}`);

      return NextResponse.json({ 
        success: true, 
        message: `Account ${action === 'activate' ? 'geactiveerd' : 'gedeactiveerd'}`,
        user: updatedUser
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Error managing account:', error);
    return NextResponse.json(
      { error: 'Failed to manage account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

