import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sendEmployeeInvitationEmail } from '@/lib/emailService';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

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

    const supabase = createServerClient();
    const normalizedOwner = ownerEmail.toLowerCase();
    const normalizedEmployee = employeeEmail.toLowerCase();

    // Check if Supabase user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', normalizedEmployee)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Er bestaat al een account met dit emailadres' },
        { status: 409 }
      );
    }

    // Ensure company record exists
    await supabase
      .from('companies')
      .upsert({
        owner_email: normalizedOwner,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_email' });

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

    const now = new Date().toISOString();

    const employeePermissions = {
      canViewLeads: permissions?.canViewLeads ?? true,
      canViewOrders: permissions?.canViewOrders ?? true,
      canManageEmployees: permissions?.canManageEmployees ?? false,
      canCheckout: permissions?.canCheckout ?? false,
    };

    // Create employee user in Supabase
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmployee,
        password_hash: hashedPassword,
        name: employeeName,
        company: companyName || null,
        role: 'employee',
        owner_email: normalizedOwner,
        company_id: normalizedOwner,
        can_view_leads: employeePermissions.canViewLeads,
        can_view_orders: employeePermissions.canViewOrders,
        can_manage_employees: employeePermissions.canManageEmployees,
        can_checkout: employeePermissions.canCheckout,
        is_active: false,
        needs_password_reset: true,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error('❌ Failed to create employee user in Supabase:', insertError);
      return NextResponse.json({ error: 'Kon werknemer niet aanmaken' }, { status: 500 });
    }

    const { error: employeeRelationError } = await supabase
      .from('company_employees')
      .upsert({
        owner_email: normalizedOwner,
        employee_email: normalizedEmployee,
        employee_name: employeeName,
        invited_at: now,
        is_active: false,
        needs_password_reset: true,
        can_view_leads: employeePermissions.canViewLeads,
        can_view_orders: employeePermissions.canViewOrders,
        can_manage_employees: employeePermissions.canManageEmployees,
        can_checkout: employeePermissions.canCheckout,
        created_at: now,
        updated_at: now,
      }, { onConflict: 'owner_email, employee_email' });

    if (employeeRelationError) {
      console.error('❌ Failed to upsert company employee record:', employeeRelationError);
      return NextResponse.json({ error: 'Kon werknemer niet koppelen aan bedrijf' }, { status: 500 });
    }

    console.log('✅ Employee account created:', normalizedEmployee);

    // Send invitation email
    const setupUrl = `${request.nextUrl.origin}/portal?setup=${encodeURIComponent(employeeEmail)}`;
    
    const emailSent = await sendEmployeeInvitationEmail({
      employeeName,
      employeeEmail: normalizedEmployee,
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
        email: normalizedEmployee,
        name: employeeName,
        needsPasswordReset: true,
        isActive: false,
        invitedAt: now
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
