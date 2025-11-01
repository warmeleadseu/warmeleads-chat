import { NextRequest, NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import { safeLog } from '@/lib/logger';
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

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');

    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Owner email is required' },
        { status: 400 }
      );
    }

    console.log('📋 Getting company data for:', ownerEmail);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuratie fout' },
        { status: 500 }
      );
    }

    const blobKey = `companies/${ownerEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;

    try {
      const { blobs } = await list({
        prefix: blobKey,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      if (blobs.length === 0) {
        // Create default company data if it doesn't exist
        const defaultCompany = {
          id: ownerEmail,
          ownerEmail,
          companyName: '', // Will be set when needed
          employees: [],
          createdAt: new Date().toISOString()
        };

        await put(blobKey, JSON.stringify(defaultCompany, null, 2), {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        return NextResponse.json({
          success: true,
          company: defaultCompany
        });
      }

      // Use cache-busting headers to ensure fresh data
      const response = await fetch(blobs[0].url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch company data');
      }

      const companyData = await response.json();
      
      console.log('📋 Company data loaded:', { 
        ownerEmail, 
        totalEmployees: companyData.employees?.length || 0,
        employeeEmails: companyData.employees?.map((emp: any) => emp.email) || []
      });

      return NextResponse.json({
        success: true,
        company: companyData
      });

    } catch (blobError) {
      console.error('❌ Blob Storage error:', blobError);
      return NextResponse.json(
        { error: 'Fout bij het ophalen van bedrijfsgegevens' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Get company error:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { ownerEmail, companyName, employeeEmail, employeeName, permissions } = await request.json();

    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Owner email is required' },
        { status: 400 }
      );
    }

    // Security: User can only manage their own company (unless admin)
    if (ownerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only manage your own company' },
        { status: 403 }
      );
    }

    console.log('📝 POST /api/auth/company - Adding employee:', { ownerEmail, employeeEmail });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuratie fout' },
        { status: 500 }
      );
    }

    const blobKey = `companies/${ownerEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;

    // Get existing company data
    let companyData;
    try {
      const { blobs } = await list({
        prefix: blobKey,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      if (blobs.length > 0) {
        const response = await fetch(blobs[0].url);
        if (response.ok) {
          companyData = await response.json();
        }
      }
    } catch (error) {
      console.log('Creating new company data');
    }

    // If no existing data, create new
    if (!companyData) {
      companyData = {
        id: ownerEmail,
        ownerEmail,
        companyName: companyName || '',
        employees: [],
        createdAt: new Date().toISOString()
      };
    }

    // Add new employee if provided
    if (employeeEmail && employeeName) {
      const newEmployee = {
        email: employeeEmail,
        name: employeeName,
        role: 'employee' as const,
        permissions: permissions || {
          canViewLeads: true,
          canViewOrders: true,
          canManageEmployees: false,
          canCheckout: false,
        },
        invitedAt: new Date().toISOString(),
        isActive: false, // Will be activated when they set password
        acceptedAt: undefined
      };

      // Check if employee already exists
      const existingIndex = companyData.employees.findIndex(
        (emp: any) => emp.email === employeeEmail
      );

      if (existingIndex >= 0) {
        companyData.employees[existingIndex] = newEmployee;
      } else {
        companyData.employees.push(newEmployee);
      }

      // Update company name if provided
      if (companyName) {
        companyData.companyName = companyName;
      }
    }

    // Save updated company data
    const blob = await put(blobKey, JSON.stringify(companyData, null, 2), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    });

    console.log('✅ Company data updated:', ownerEmail);

    return NextResponse.json({
      success: true,
      company: companyData
    });

  } catch (error) {
    console.error('❌ Error in POST /api/auth/company:', error);
    return NextResponse.json(
      { error: 'Fout bij het bijwerken van bedrijfsgegevens' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    console.log('🗑️ Removing employee:', { ownerEmail, employeeEmail });

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

      const companyData = await response.json();

      // Remove employee from company data with case-insensitive comparison
      const initialLength = companyData.employees?.length || 0;
      
      console.log('🔍 Before filtering - All employees:', companyData.employees?.map((emp: EmployeeAccount) => ({
        email: emp.email,
        name: emp.name,
        targetEmail: employeeEmail,
        exactMatch: emp.email === employeeEmail,
        caseInsensitiveMatch: emp.email.toLowerCase() === employeeEmail.toLowerCase()
      })));
      
      const filteredEmployees = companyData.employees.filter((emp: EmployeeAccount) => {
        const isMatch = emp.email.toLowerCase() === employeeEmail.toLowerCase();
        console.log(`🔍 Checking ${emp.email} against ${employeeEmail}: ${isMatch ? 'MATCH - WILL REMOVE' : 'NO MATCH - KEEP'}`);
        return !isMatch;
      });
      
      console.log('🗑️ Employee removal result:', { 
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
      console.log('💾 Saving updated company data:', {
        blobKey,
        employeeCount: companyData.employees?.length || 0,
        remainingEmails: companyData.employees?.map((emp: EmployeeAccount) => emp.email) || []
      });
      
      await put(blobKey, updatedDataString, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
      });
      
      // Verify the save operation was successful by reading it back
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay to ensure write is complete
        
        // Re-fetch the blob to get the latest URL (avoid caching issues)
        const { blobs: verifyBlobs } = await list({
          prefix: blobKey,
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        
        if (verifyBlobs.length > 0) {
          const verifyResponse = await fetch(verifyBlobs[0].url, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const verifyCount = verifyData.employees?.length || 0;
            const expectedCount = companyData.employees?.length || 0;
            const remainingEmails = verifyData.employees?.map((emp: EmployeeAccount) => emp.email) || [];
            
            console.log('🔍 Verification result:', {
              expectedCount,
              actualCount: verifyCount,
              expectedEmails: companyData.employees?.map((emp: EmployeeAccount) => emp.email) || [],
              actualEmails: remainingEmails,
              targetEmailStillExists: remainingEmails.includes(employeeEmail),
              caseInsensitiveTargetExists: remainingEmails.some((email: string) => email.toLowerCase() === employeeEmail.toLowerCase())
            });
            
            // Check if target email still exists (including case variations)
            const targetStillExists = remainingEmails.some((email: string) => email.toLowerCase() === employeeEmail.toLowerCase());
            if (targetStillExists) {
              console.error('❌ Target email still exists in blob storage after deletion!', {
                targetEmail: employeeEmail,
                remainingEmails,
                foundVariations: remainingEmails.filter((email: string) => email.toLowerCase() === employeeEmail.toLowerCase())
              });
            }
          }
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify save operation:', verifyError);
      }

      // Also remove the employee account from auth-accounts
      const employeeBlobKey = `auth-accounts/${employeeEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
      try {
        await del(employeeBlobKey, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        console.log('✅ Employee account deleted from auth-accounts:', employeeEmail);
      } catch (delError) {
        console.warn('⚠️ Could not delete employee account from auth-accounts:', delError);
        // Don't fail the entire operation if account deletion fails
      }

      console.log('✅ Employee removed from company:', employeeEmail);

      return NextResponse.json({
        success: true,
        message: 'Werknemer succesvol verwijderd'
      });

    } catch (blobError) {
      console.error('❌ Blob Storage error:', blobError);
      return NextResponse.json(
        { error: 'Fout bij het verwijderen van werknemer' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in DELETE /api/auth/company:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
}
