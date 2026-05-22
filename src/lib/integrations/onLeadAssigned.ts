import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';

export function onLeadAssignedToCustomer(args: {
  customerId: string;
  leadId: string;
  assignmentId: string;
}): void {
  void syncAssignmentToTeamleader(args).catch((err) => {
    console.error('[teamleader] sync failed', {
      customerId: args.customerId,
      assignmentId: args.assignmentId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
