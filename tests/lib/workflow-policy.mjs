// Pure workflow policy (#140). `check(workflowObject)` takes one parsed `.github/workflows/*.yml`
// and returns the list of violations as strings; an empty list means the workflow complies.
// Named write scopes (`pages: write`, `id-token: write`, `actions: write`) are allowed.

const isWriteAll = (permissions) => typeof permissions === 'string' && permissions.trim() === 'write-all';
const isFalse = (value) => value === false || value === 'false';

export function check(workflow) {
  const violations = [];
  const jobs = Object.entries(workflow?.jobs ?? {});

  if (workflow?.permissions === undefined || workflow.permissions === null) {
    violations.push('no top-level permissions block');
  } else if (isWriteAll(workflow.permissions)) {
    violations.push('top-level permissions: write-all');
  }

  for (const [jobId, job] of jobs) {
    if (isWriteAll(job?.permissions)) violations.push(`job ${jobId}: permissions: write-all`);
    if (job?.secrets === 'inherit') violations.push(`job ${jobId}: secrets: inherit`);
    (job?.steps ?? []).forEach((step, index) => {
      if (!String(step?.uses ?? '').startsWith('actions/checkout')) return;
      if (!isFalse(step.with?.['persist-credentials'])) {
        violations.push(`job ${jobId}: step ${index + 1} (${step.name ?? step.uses}): actions/checkout without persist-credentials: false`);
      }
    });
  }
  return violations;
}
