import { NextRequest, NextResponse } from 'next/server';
import { safeLog } from '@/lib/logger';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

interface EmployeeAccount {
  email: string;
  name: string;
  role: 'employee';
  permissions: {
    canViewLeads: boolean;
    canViewOrders: boolean;
    canManageEmployees: boolean;
    canCheckout: boolean;
  };
  invitedAt: string;
  acceptedAt?: string;
  isActive: boolean;
}

interface CompanyData {
  id: string;
  ownerEmail: string;
  companyName: string;
  employees: EmployeeAccount[];
  createdAt: string;
}

export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');
    const employeeEmail = searchParams.get('employeeEmail');

    if (!ownerEmail || !employeeEmail) {
      return NextResponse.json(
        { error: 'Owner email and employee email are required' },
        { status: 400 }
      );
    }

    // Security check: User can only delete employees from their own company (unless admin)
    if (!isAdmin(user.email) && ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    safeLog.log('🔧 Force deleting employee:', { ownerEmail, employeeEmail });

    const supabase = createServerClient();

    const normalizedOwner = ownerEmail.toLowerCase();
    const normalizedEmployee = employeeEmail.toLowerCase();

    const { data: employeeRow } = await supabase
      .from('company_employees')
      .select('*')
      .eq('owner_email', normalizedOwner)
      .eq('employee_email', normalizedEmployee)
      .maybeSingle();

    safeLog.log('🔍 Force deletion row check:', {
      found: !!employeeRow,
      owner: normalizedOwner,
      employee: normalizedEmployee,
    });

    await supabase
      .from('company_employees')
      .delete()
      .eq('owner_email', normalizedOwner)
      .eq('employee_email', normalizedEmployee);

    await supabase
      .from('users')
      .delete()
      .eq('email', normalizedEmployee);

    safeLog.log('✅ Force deletion completed (Supabase):', {
      owner: normalizedOwner,
      employee: normalizedEmployee,
    });

    return NextResponse.json({
      success: true,
      message: 'Werknemer geforceerd verwijderd',
    });

  } catch (error) {
    safeLog.error('❌ Error in force delete:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
});
