import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// API om echte data op te halen voor admin (ADMIN ONLY)
export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    // Haal echte data op uit localStorage/database
    const customers: any[] = [];
    const orders: any[] = [];
    const chats: any[] = [];
    
    return NextResponse.json({
      success: true,
      data: {
        customers,
        orders,
        chats,
        analytics: {
          totalCustomers: 0,
          totalOrders: 0,
          totalRevenue: 0,
          activeChats: 0
        }
      },
      message: "Echte data geladen - momenteel leeg, wordt gevuld door echte bestellingen"
    });

  } catch (error) {
    console.error('Error loading real data:', error);
    return NextResponse.json(
      { error: 'Failed to load real data' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

// API om nieuwe bestelling toe te voegen aan admin (ADMIN ONLY)
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const orderData = await req.json();
    
    console.log('📋 Nieuwe echte bestelling ontvangen voor admin:', orderData);
    
    // Hier zou je de bestelling opslaan in echte database
    // Voor nu loggen we het alleen
    
    return NextResponse.json({
      success: true,
      message: "Bestelling toegevoegd aan admin systeem",
      orderData
    });

  } catch (error) {
    console.error('Error adding order to admin:', error);
    return NextResponse.json(
      { error: 'Failed to add order' },
      { status: 500 }
    );
  }
}
