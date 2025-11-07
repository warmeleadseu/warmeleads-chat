import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

const isAdminEmail = (email: string): boolean => {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((entry) => entry.trim()) || [];
  return adminEmails.includes(email.toLowerCase());
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapEmployeeRow = (row: any): EmployeeAccount => ({
  email: row.employee_email,
  name: row.employee_name,
  role: 'employee',
  permissions: {
    canViewLeads: row.can_view_leads ?? true,
    canViewOrders: row.can_view_orders ?? true,
    canManageEmployees: row.can_manage_employees ?? false,
    canCheckout: row.can_checkout ?? false,
  },
  invitedAt: row.invited_at || new Date().toISOString(),
  acceptedAt: row.accepted_at || undefined,
  isActive: row.is_active ?? false,
});

async function fetchCompanyData(supabase: ReturnType<typeof createServerClient>, ownerEmail: string): Promise<CompanyData> {
  const { data: companyRow } = await supabase
    .from('companies')
    .select('company_name, created_at')
    .eq('owner_email', ownerEmail)
    .maybeSingle();

  const { data: employeeRows } = await supabase
    .from('company_employees')
    .select('*')
    .eq('owner_email', ownerEmail)
    .order('invited_at', { ascending: true });

  return {
    id: ownerEmail,
    ownerEmail,
    companyName: companyRow?.company_name || '',
    employees: (employeeRows || []).map(mapEmployeeRow),
    createdAt: companyRow?.created_at || new Date().toISOString(),
  };
}

const ensureOwnerAccess = (requestedOwner: string, user: AuthenticatedUser): NextResponse | null => {
  if (isAdminEmail(user.email)) {
    return null;
  }

  if (normalizeEmail(requestedOwner) !== normalizeEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden - Je kunt alleen je eigen team beheren' }, { status: 403 });
  }

  return null;
};

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');

    if (!ownerEmail) {
      return NextResponse.json({ error: 'Owner email is required' }, { status: 400 });
    }

    const accessError = ensureOwnerAccess(ownerEmail, user);
    if (accessError) return accessError;

    const supabase = createServerClient();
    const companyData = await fetchCompanyData(supabase, normalizeEmail(ownerEmail));

    return NextResponse.json({ success: true, company: companyData });
  } catch (error) {
    console.error('❌ Get company error:', error);
    return NextResponse.json({ error: 'Er is een onverwachte fout opgetreden' }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { ownerEmail, companyName, employeeEmail, employeeName, permissions } = await request.json();

    if (!ownerEmail) {
      return NextResponse.json({ error: 'Owner email is required' }, { status: 400 });
    }

    const accessError = ensureOwnerAccess(ownerEmail, user);
    if (accessError) return accessError;

    const normalizedOwner = normalizeEmail(ownerEmail);
    const supabase = createServerClient();

    if (companyName !== undefined) {
      const { error: companyError } = await supabase
        .from('companies')
        .upsert(
          {
            owner_email: normalizedOwner,
            company_name: companyName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'owner_email' }
        );

      if (companyError) {
        console.error('❌ Could not upsert company record:', companyError);
        return NextResponse.json({ error: 'Fout bij het opslaan van bedrijfsgegevens' }, { status: 500 });
      }
    }

    if (employeeEmail) {
      const normalizedEmployee = normalizeEmail(employeeEmail);
      const now = new Date().toISOString();

      const { data: existingEmployee } = await supabase
        .from('company_employees')
        .select('*')
        .eq('owner_email', normalizedOwner)
        .eq('employee_email', normalizedEmployee)
        .maybeSingle();

      const employeePayload = {
        owner_email: normalizedOwner,
        employee_email: normalizedEmployee,
        employee_name: employeeName || existingEmployee?.employee_name || normalizedEmployee,
        invited_at: existingEmployee?.invited_at || now,
        accepted_at: existingEmployee?.accepted_at || null,
        is_active: existingEmployee?.is_active ?? false,
        needs_password_reset: existingEmployee?.needs_password_reset ?? true,
        can_view_leads: permissions?.canViewLeads ?? existingEmployee?.can_view_leads ?? true,
        can_view_orders: permissions?.canViewOrders ?? existingEmployee?.can_view_orders ?? true,
        can_manage_employees: permissions?.canManageEmployees ?? existingEmployee?.can_manage_employees ?? false,
        can_checkout: permissions?.canCheckout ?? existingEmployee?.can_checkout ?? false,
        updated_at: now,
      };

      const { error: employeeError } = await supabase
        .from('company_employees')
        .upsert(employeePayload, { onConflict: 'owner_email, employee_email' });

      if (employeeError) {
        console.error('❌ Could not upsert employee:', employeeError);
        return NextResponse.json({ error: 'Fout bij het opslaan van werknemer' }, { status: 500 });
      }
    }

    const companyData = await fetchCompanyData(supabase, normalizedOwner);
    return NextResponse.json({ success: true, company: companyData });
  } catch (error) {
    console.error('❌ Error in POST /api/auth/company:', error);
    return NextResponse.json({ error: 'Fout bij het bijwerken van bedrijfsgegevens' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');
    const employeeEmail = searchParams.get('employeeEmail');

    if (!ownerEmail || !employeeEmail) {
      return NextResponse.json({ error: 'Owner email en employee email zijn verplicht' }, { status: 400 });
    }

    const accessError = ensureOwnerAccess(ownerEmail, user);
    if (accessError) return accessError;

    const normalizedOwner = normalizeEmail(ownerEmail);
    const normalizedEmployee = normalizeEmail(employeeEmail);
    const supabase = createServerClient();

    await supabase
      .from('company_employees')
      .delete()
      .eq('owner_email', normalizedOwner)
      .eq('employee_email', normalizedEmployee);

    await supabase
      .from('users')
      .delete()
      .eq('email', normalizedEmployee);

    const companyData = await fetchCompanyData(supabase, normalizedOwner);

    return NextResponse.json({
      success: true,
      message: 'Werknemer succesvol verwijderd',
      company: companyData,
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/auth/company:', error);
    return NextResponse.json({ error: 'Er is een onverwachte fout opgetreden' }, { status: 500 });
  }
});
