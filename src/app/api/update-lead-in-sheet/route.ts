import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { updateLeadInSheetServerSide } from '@/lib/googleSheetsServerSide';

/**
 * API route to update a lead in Google Sheets (server-side with Service Account)
 * This ensures proper authentication with the Service Account instead of client-side calls
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { googleSheetUrl, lead } = body;

    console.log('📊 API: Updating lead in Google Sheets', {
      url: googleSheetUrl,
      leadId: lead.id,
      leadName: lead.name,
      rowNumber: lead.sheetRowNumber
    });

    if (!googleSheetUrl) {
      return NextResponse.json(
        { success: false, error: 'Google Sheet URL is required' },
        { status: 400 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead data is required' },
        { status: 400 }
      );
    }

    if (!lead.sheetRowNumber) {
      return NextResponse.json(
        { success: false, error: 'Lead sheet row number is required' },
        { status: 400 }
      );
    }

    // Update lead in Google Sheets using server-side Service Account authentication
    await updateLeadInSheetServerSide(googleSheetUrl, lead);

    console.log('✅ API: Successfully updated lead in Google Sheets');

    return NextResponse.json({
      success: true,
      message: 'Lead updated in Google Sheets'
    });

  } catch (error) {
    console.error('❌ API: Error updating lead in Google Sheets:', error);
    console.error('❌ API: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      error: error
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
});

