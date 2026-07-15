/** Parse comma-separated branch slugs from export request body. */
export function parseExportBranchFilter(branch: unknown): string[] {
  if (branch == null || branch === '') return [];
  return String(branch)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Bulk export requires at least one branch filter. */
export function validateExportBranchFilter(branch: unknown): { ok: true; branches: string[] } | { ok: false; error: string } {
  const branches = parseExportBranchFilter(branch);
  if (branches.length === 0) {
    return { ok: false, error: 'Selecteer minimaal één branche om te exporteren' };
  }
  return { ok: true, branches };
}

/**
 * When exporting to a customer portal, selected branches must match the
 * customer's configured branches.
 */
export function validatePortalExportBranches(
  selectedBranches: string[],
  customerBranches: string[],
): { ok: true } | { ok: false; error: string } {
  if (customerBranches.length === 0) return { ok: true };
  const allowed = new Set(customerBranches);
  const invalid = selectedBranches.filter(b => !allowed.has(b));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Geselecteerde branche(s) ${invalid.join(', ')} horen niet bij deze klant (${customerBranches.join(', ')})`,
    };
  }
  return { ok: true };
}
