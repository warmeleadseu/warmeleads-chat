import { NextRequest, NextResponse } from 'next/server';
import { put, list, head } from '@vercel/blob';
import bcrypt from 'bcryptjs';

// Public endpoint - employee activation with email/password only
// Security: No auth required, but validates employee account exists
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email en wachtwoord zijn verplicht' },
        { status: 400 }
      );
    }

      console.log('🔑 POST /api/auth/activate-employee - Activating:', email);
      console.log('🔍 Looking for employee blob key:', `auth-accounts/${email.replace('@', '_at_').replace(/\./g, '_dot_')}.json`);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuratie fout' },
        { status: 500 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get employee account
    const employeeBlobKey = `auth-accounts/${email.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
    
    try {
      const blobExists = await head(employeeBlobKey, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      if (!blobExists) {
        return NextResponse.json(
          { error: 'Account niet gevonden' },
          { status: 404 }
        );
      }

      const response = await fetch(blobExists.url);
      if (!response.ok) {
        throw new Error('Failed to fetch account data');
      }

      const accountData = await response.json();

      // Check if this is an employee account that needs activation
      if (accountData.role !== 'employee' || !accountData.needsPasswordReset) {
        return NextResponse.json(
          { error: 'Account kan niet worden geactiveerd' },
          { status: 400 }
        );
      }

      // Update account data
      const updatedAccountData = {
        ...accountData,
        password: hashedPassword,
        needsPasswordReset: false,
        isActive: true,
        activatedAt: new Date().toISOString()
      };

      console.log('💾 Saving updated account data:', {
        email,
        isActive: true,
        needsPasswordReset: false,
        blobKey: employeeBlobKey
      });

      // Save updated account
      await put(employeeBlobKey, JSON.stringify(updatedAccountData, null, 2), {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
      });
      
      console.log('✅ Account data saved successfully');
      
      // Verify the save was successful by reading it back
      try {
        const verifyBlobExists = await head(employeeBlobKey, {
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        
        if (verifyBlobExists) {
          const verifyResponse = await fetch(verifyBlobExists.url, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log('✅ Verification: Account data persisted correctly', {
              email: verifyData.email,
              isActive: verifyData.isActive,
              needsPasswordReset: verifyData.needsPasswordReset
            });
          } else {
            console.warn('⚠️ Could not verify saved account data:', verifyResponse.status);
          }
        }
      } catch (verifyError) {
        console.warn('⚠️ Error verifying saved account data:', verifyError);
      }

      // Update company data to mark employee as active
      if (accountData.ownerEmail) {
        const companyBlobKey = `companies/${accountData.ownerEmail.replace('@', '_at_').replace(/\./g, '_dot_')}.json`;
        
        try {
          const companyBlobExists = await head(companyBlobKey, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });

          if (companyBlobExists) {
            const companyResponse = await fetch(companyBlobExists.url);
            if (companyResponse.ok) {
              const companyData = await companyResponse.json();
              
              // Update employee status in company data
              const employeeIndex = companyData.employees.findIndex(
                (emp: any) => emp.email === email
              );
              
              if (employeeIndex >= 0) {
                companyData.employees[employeeIndex] = {
                  ...companyData.employees[employeeIndex],
                  isActive: true,
                  acceptedAt: new Date().toISOString()
                };

                // Save updated company data
                await put(companyBlobKey, JSON.stringify(companyData, null, 2), {
                  access: 'public',
                  token: process.env.BLOB_READ_WRITE_TOKEN,
                  allowOverwrite: true,
                });
              }
            }
          }
        } catch (error) {
          console.warn('Could not update company data:', error);
        }
      }

      console.log('✅ Employee account activated:', email);

      return NextResponse.json({
        success: true,
        message: 'Account succesvol geactiveerd',
        employee: {
          email,
          name: accountData.name,
          isActive: true,
          activatedAt: updatedAccountData.activatedAt
        }
      });

    } catch (error) {
      console.error('❌ Error activating employee account:', error);
      return NextResponse.json(
        { error: 'Fout bij het activeren van account' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in POST /api/auth/activate-employee:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
}
