/**
 * API AUTHENTICATION MIDDLEWARE
 * 
 * Centralized authentication for all API routes.
 * Verifies user tokens and provides role-based access control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'employee' | 'admin';
  companyId?: string;
  permissions: {
    canViewLeads: boolean;
    canViewOrders: boolean;
    canManageEmployees: boolean;
    canCheckout: boolean;
  };
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
}

/**
 * Verify authentication token from request
 */
export async function verifyAuthToken(request: NextRequest): Promise<AuthResult> {
  try {
    // Try to get token from Authorization header
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');
    
    // Fallback to cookie
    if (!token) {
      token = request.cookies.get('auth-token')?.value;
    }
    
    // Try email from query params (legacy, for backwards compatibility)
    if (!token) {
      const { searchParams } = new URL(request.url);
      const email = searchParams.get('email');
      
      if (email) {
        // Verify this is a valid user
        const supabase = createServerClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();
        
        if (!error && user) {
          return {
            user: transformUser(user),
            error: null
          };
        }
      }
    }
    
    if (!token) {
      return { user: null, error: 'No authentication token provided' };
    }
    
    // Verify token with Supabase
    const supabase = createServerClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', token)
      .single();
    
    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' };
    }
    
    // Check if account is active
    if (!user.is_active && user.role === 'employee') {
      return { user: null, error: 'Account not yet activated' };
    }
    
    return {
      user: transformUser(user),
      error: null
    };
  } catch (error) {
    console.error('❌ Auth verification error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}

/**
 * Transform database user to AuthenticatedUser
 */
function transformUser(dbUser: any): AuthenticatedUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role || 'owner',
    companyId: dbUser.company_id,
    permissions: {
      canViewLeads: dbUser.can_view_leads ?? true,
      canViewOrders: dbUser.can_view_orders ?? true,
      canManageEmployees: dbUser.can_manage_employees ?? false,
      canCheckout: dbUser.can_checkout ?? true,
    }
  };
}

/**
 * Middleware wrapper for API routes requiring authentication
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options?: {
    adminOnly?: boolean;
    requiredPermission?: keyof AuthenticatedUser['permissions'];
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user, error } = await verifyAuthToken(request);
    
    if (error || !user) {
      return NextResponse.json(
        { error: error || 'Unauthorized', requiresAuth: true },
        { status: 401 }
      );
    }
    
    // Check admin requirement
    if (options?.adminOnly) {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
      if (!adminEmails.includes(user.email)) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }
    }
    
    // Check specific permission
    if (options?.requiredPermission && !user.permissions[options.requiredPermission]) {
      return NextResponse.json(
        { error: `Forbidden - Permission '${options.requiredPermission}' required` },
        { status: 403 }
      );
    }
    
    // Call the actual handler with authenticated user
    try {
      return await handler(request, user);
    } catch (error) {
      console.error('❌ Handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware for ownership verification
 * Checks if the authenticated user owns the resource they're trying to access
 */
export function withOwnership(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  resourceGetter: (request: NextRequest) => Promise<{ ownerId: string } | null>
) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
    // Admin can access everything
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (adminEmails.includes(user.email)) {
      return handler(request, user);
    }
    
    // Check ownership
    const resource = await resourceGetter(request);
    
    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }
    
    if (resource.ownerId !== user.id && resource.ownerId !== user.email) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this resource' },
        { status: 403 }
      );
    }
    
    return handler(request, user);
  });
}

/**
 * Optional auth - allows both authenticated and unauthenticated access
 * Useful for routes that behave differently based on auth status
 */
export function withOptionalAuth(
  handler: (request: NextRequest, user: AuthenticatedUser | null) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user } = await verifyAuthToken(request);
    
    try {
      return await handler(request, user);
    } catch (error) {
      console.error('❌ Handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Rate limiting helper (basic implementation)
 * TODO: Implement proper rate limiting with Redis/Vercel KV
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

export function withRateLimit(
  handler: Function,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return async (request: NextRequest, ...args: any[]) => {
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
    
    if (!checkRateLimit(identifier, maxRequests, windowMs)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
      );
    }
    
    return handler(request, ...args);
  };
}

