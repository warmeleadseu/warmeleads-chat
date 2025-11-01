import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, updates } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'E-mailadres is vereist' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Ongeldige update gegevens' },
        { status: 400 }
      );
    }

    console.log('📝 Updating profile for:', email);

    const supabase = createServerClient();

    // Build update object (only include fields that are being updated)
    const updateData: {
      name?: string;
      company?: string | null;
      phone?: string | null;
    } = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.company !== undefined) updateData.company = updates.company || null;
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Geen geldige velden om bij te werken' },
        { status: 400 }
      );
    }

    // Update profile in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('email', email.toLowerCase())
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('❌ Supabase update error:', updateError);
      return NextResponse.json(
        { 
          error: 'Fout bij het opslaan van profiel wijzigingen',
          details: updateError?.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Also update company record if company name changed
    if (updates.company !== undefined && updates.company) {
      const { error: companyError } = await supabase
        .from('companies')
        .upsert({
          owner_email: email.toLowerCase(),
          company_name: updates.company,
        }, {
          onConflict: 'owner_email'
        });
      
      if (companyError) {
        console.warn('⚠️ Could not update company record:', companyError);
        // Don't fail the update if company update fails
      }
    }

    console.log('✅ Profile updated successfully:', {
      email,
      updatedFields: Object.keys(updateData)
    });

    return NextResponse.json({
      success: true,
      message: 'Profiel succesvol bijgewerkt',
      updatedFields: Object.keys(updateData)
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
}
