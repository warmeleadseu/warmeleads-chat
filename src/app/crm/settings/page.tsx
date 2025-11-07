import { redirect } from 'next/navigation';

export default function LegacyCRMSettingsRedirect() {
  redirect('/crm/leads#instellingen');
}

