import { NextRequest, NextResponse } from 'next/server';
import { list, put, del } from '@vercel/blob';
import { safeLog } from '@/lib/logger';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

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

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuratie fout' },
        { status: 500 }
      );
    }

    const blobKey = `companies/${ownerEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;

    // Get existing company data
    try {
      const { blobs } = await list({
        prefix: blobKey,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      // Use cache-busting headers to ensure we get fresh data
      const response = await fetch(blobs[0].url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch company data');
      }

      const companyData: CompanyData = await response.json();

      safeLog.log('🔍 Before force deletion - All employees:', companyData.employees?.map((emp: EmployeeAccount) => ({
        email: emp.email,
        name: emp.name,
        targetEmail: employeeEmail,
        exactMatch: emp.email === employeeEmail,
        caseInsensitiveMatch: emp.email.toLowerCase() === employeeEmail.toLowerCase()
      })));

      // Force remove employee with multiple attempts using different matching strategies
      const initialLength = companyData.employees?.length || 0;
      
      // Try multiple filtering strategies
      let filteredEmployees = companyData.employees.filter((emp: EmployeeAccount) => {
        const exactMatch = emp.email === employeeEmail;
        const caseInsensitiveMatch = emp.email.toLowerCase() === employeeEmail.toLowerCase();
        const trimmedMatch = emp.email.trim() === employeeEmail.trim();
        
        const shouldRemove = exactMatch || caseInsensitiveMatch || trimmedMatch;
        
        safeLog.log(`🔍 Force check ${emp.email} vs ${employeeEmail}: exact=${exactMatch}, case=${caseInsensitiveMatch}, trimmed=${trimmedMatch} => ${shouldRemove ? 'REMOVE' : 'KEEP'}`);
        
        return !shouldRemove;
      });

      // If still not removed, try to find by name matching (in case email was corrupted)
      if (filteredEmployees.length === initialLength) {
        safeLog.log('⚠️ Email-based deletion failed, trying name-based approach');
        // Look for similar names (this is more aggressive, only use if needed)
        filteredEmployees = companyData.employees.filter((emp: EmployeeAccount) => {
          const nameMatches = emp.name.toLowerCase().includes('test') || 
                             emp.name.toLowerCase().includes('testje') ||
                             emp.name.toLowerCase() === employeeEmail.split('@')[0].toLowerCase();
          
          safeLog.log(`🔍 Name check ${emp.name} for target ${employeeEmail}: ${nameMatches ? 'POSSIBLE MATCH' : 'NO MATCH'}`);
          
          return !nameMatches;
        });
      }

      safeLog.log('🔧 Force deletion result:', { 
        initialLength, 
        newLength: filteredEmployees.length,
        removed: initialLength - filteredEmployees.length,
        targetEmail: employeeEmail,
        beforeFilter: companyData.employees?.map((emp: EmployeeAccount) => emp.email),
        afterFilter: filteredEmployees.map((emp: EmployeeAccount) => emp.email)
      });

      // Update the company data with filtered employees
      companyData.employees = filteredEmployees;

      // Save updated company data
      const updatedDataString = JSON.stringify(companyData, null, 2);
      
      await put(blobKey, updatedDataString, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
      });

      // Also remove the employee account from auth-accounts with multiple strategies
      const employeeBlobKeys = [
        `auth-accounts/${employeeEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`,
        `auth-accounts/${employeeEmail.toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_')}.json`,
        `auth-accounts/${employeeEmail.toUpperCase().replace('@', '_at_').replace(/\./g, '_dot_')}.json`
      ];

      let accountDeleted = false;
      for (const blobKey of employeeBlobKeys) {
        try {
          await del(blobKey, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          safeLog.log('✅ Employee account deleted from auth-accounts:', blobKey);
          accountDeleted = true;
          break;
        } catch (delError) {
          safeLog.log('⚠️ Could not delete with key:', blobKey, delError);
        }
      }

      safeLog.log('✅ Force deletion completed:', { 
        employeeEmail, 
        companyEmployeesRemoved: initialLength - filteredEmployees.length,
        accountDeleted 
      });

      return NextResponse.json({
        success: true,
        message: 'Werknemer geforceerd verwijderd',
        removedFromCompany: initialLength - filteredEmployees.length,
        accountDeleted
      });

    } catch (blobError) {
      safeLog.error('❌ Blob Storage error during force deletion:', blobError);
      return NextResponse.json(
        { error: 'Fout bij het geforceerd verwijderen van werknemer' },
        { status: 500 }
      );
    }

  } catch (error) {
    safeLog.error('❌ Error in force delete:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
});
