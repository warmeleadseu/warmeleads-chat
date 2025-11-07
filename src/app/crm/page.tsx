import { redirect } from 'next/navigation';

export default function CRMRootRedirect() {
  redirect('/portal/leads');
}

