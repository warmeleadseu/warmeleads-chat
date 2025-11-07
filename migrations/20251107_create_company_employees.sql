-- Create table for managing company employees via Supabase

CREATE TABLE IF NOT EXISTS public.company_employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_email text NOT NULL,
    employee_email text NOT NULL,
    employee_name text NOT NULL,
    invited_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    is_active boolean NOT NULL DEFAULT false,
    needs_password_reset boolean NOT NULL DEFAULT true,
    can_view_leads boolean NOT NULL DEFAULT true,
    can_view_orders boolean NOT NULL DEFAULT true,
    can_manage_employees boolean NOT NULL DEFAULT false,
    can_checkout boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_employees_owner_employee_idx
    ON public.company_employees(owner_email, employee_email);

CREATE INDEX IF NOT EXISTS company_employees_owner_idx
    ON public.company_employees(owner_email);

-- Ensure companies table exists to link owners
CREATE TABLE IF NOT EXISTS public.companies (
    owner_email text PRIMARY KEY,
    company_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
