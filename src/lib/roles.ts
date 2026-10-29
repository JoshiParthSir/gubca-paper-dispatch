/** Display names for account roles, used everywhere a role is shown. */
export const ROLE_LABELS = {
  chairperson: 'University / Chairperson',
  college_admin: 'College Admin',
} as const;

export function roleLabel(role: string | null | undefined): string {
  if (role === 'chairperson') return ROLE_LABELS.chairperson;
  if (role === 'college_admin') return ROLE_LABELS.college_admin;
  return 'Not set';
}
