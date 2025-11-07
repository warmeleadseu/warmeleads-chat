import { redirect } from 'next/navigation';

export default function LegacyCRMRedirect() {
  redirect('/crm/leads');
}

