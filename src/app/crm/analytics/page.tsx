import { redirect } from 'next/navigation';

export default function LegacyCRMAnalyticsRedirect() {
  redirect('/crm/leads#analytics');
}

