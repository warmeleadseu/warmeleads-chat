import { redirect } from 'next/navigation';

export default function LegacyCRMLeadsRedirect() {
  redirect('/portal/leads');
}