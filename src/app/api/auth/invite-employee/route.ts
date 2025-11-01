import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import bcrypt from 'bcryptjs';
import { sendEmployeeInvitationEmail } from '@/lib/emailService';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { ownerEmail, employeeEmail, employeeName, permissions } = await request.json();

    if (!ownerEmail || !employeeEmail || !employeeName) {
      return NextResponse.json(
        { error: 'Owner email, employee email en employee name zijn verplicht' },
        { status: 400 }
      );
    }

    // Security: User can only invite employees to their own company (unless admin)
    if (ownerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only invite employees to your own company' },
        { status: 403 }
      );
    }

    console.log('📧 POST /api/auth/invite-employee - Inviting:', { ownerEmail, employeeEmail });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuratie fout' },
        { status: 500 }
      );
    }

    // Check if employee account already exists
    const employeeBlobKey = `auth-accounts/${employeeEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
    
    try {
      const { blobs } = await list({
        prefix: employeeBlobKey,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      if (blobs.length > 0) {
        return NextResponse.json(
          { error: 'Er bestaat al een account met dit emailadres' },
          { status: 409 }
        );
      }
    } catch (error) {
      console.log('Employee account check:', error);
    }

    // Add employee to company
    const companyResponse = await fetch(`${request.nextUrl.origin}/api/auth/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerEmail,
        employeeEmail,
        employeeName,
        permissions: permissions || {
          canViewLeads: true,
          canViewOrders: true,
          canManageEmployees: false,
          canCheckout: false,
        }
      })
    });

    if (!companyResponse.ok) {
      const error = await companyResponse.json();
      return NextResponse.json(
        { error: error.error || 'Fout bij het toevoegen aan bedrijf' },
        { status: 500 }
      );
    }

    // Create temporary password (employee will reset it on first login)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Get owner data for email
    let ownerName = 'Uw werkgever';
    let companyName = '';
    
    try {
      const ownerResponse = await fetch(`${request.nextUrl.origin}/api/auth/get-profile?email=${encodeURIComponent(ownerEmail)}`);
      if (ownerResponse.ok) {
        const ownerData = await ownerResponse.json();
        if (ownerData.success) {
          ownerName = ownerData.user.name || ownerName;
          companyName = ownerData.user.company || companyName;
        }
      }
    } catch (error) {
      console.log('Could not fetch owner data for email:', error);
    }

    // Create employee account data
    const employeeAccountData = {
      email: employeeEmail,
      password: hashedPassword,
      name: employeeName,
      company: companyName,
      phone: '',
      createdAt: new Date().toISOString(),
      isGuest: false,
      role: 'employee',
      companyId: ownerEmail,
      ownerEmail: ownerEmail,
      permissions: permissions || {
        canViewLeads: true,
        canViewOrders: true,
        canManageEmployees: false,
        canCheckout: false,
      },
      needsPasswordReset: true, // Employee must set password on first login
      invitedAt: new Date().toISOString(),
      isActive: false // Will be activated when they set password
    };

    // Save employee account
    await put(employeeBlobKey, JSON.stringify(employeeAccountData, null, 2), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('✅ Employee account created:', employeeEmail);

    // Send invitation email
    const setupUrl = `${request.nextUrl.origin}/portal?setup=${encodeURIComponent(employeeEmail)}`;
    
    const emailSent = await sendEmployeeInvitationEmail({
      employeeName,
      employeeEmail,
      ownerName,
      companyName,
      setupUrl
    });

    if (!emailSent) {
      console.warn('⚠️ Failed to send invitation email, but account was created');
    }
    
    return NextResponse.json({
      success: true,
      message: emailSent ? 'Werknemer is uitgenodigd en email is verzonden' : 'Werknemer is uitgenodigd (email kon niet worden verzonden)',
      employee: {
        email: employeeEmail,
        name: employeeName,
        needsPasswordReset: true,
        isActive: false,
        invitedAt: employeeAccountData.invitedAt
      }
    });

  } catch (error) {
    console.error('❌ Error in POST /api/auth/invite-employee:', error);
    return NextResponse.json(
      { error: 'Fout bij het uitnodigen van werknemer' },
      { status: 500 }
    );
  }
});
