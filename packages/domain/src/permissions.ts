import type { ID, OrgMember, PlatformRole, StaffPermission } from './types';

/**
 * Authorization model (mirrored in firestore.rules — keep in sync):
 *  - Platform roles come from Firebase custom claims (`platformRole`).
 *  - Org roles come from organizations/{orgId}/members/{uid}.
 *  - Owners & managers hold every org permission; staff only explicit grants.
 *  - Property scoping: member.propertyIds === null means all properties.
 */

export interface Actor {
  uid: ID;
  platformRole?: PlatformRole | null;
}

const ALL_PERMISSIONS: readonly StaffPermission[] = [
  'inventory.read',
  'inventory.write',
  'residents.read',
  'residents.write',
  'rent.read',
  'rent.collect',
  'maintenance.read',
  'maintenance.write',
  'notices.write',
  'leads.read',
  'leads.write',
  'listings.publish',
  'earnings.read',
];

/** Things only the org owner can do (not managers). */
export type OwnerOnlyAction = 'org.manage_members' | 'org.manage_payouts' | 'property.submit_verification';

export function permissionsOf(member: OrgMember): ReadonlySet<StaffPermission> {
  if (member.status !== 'active') return new Set();
  if (member.role === 'owner' || member.role === 'manager') return new Set(ALL_PERMISSIONS);
  return new Set(member.permissions ?? []);
}

export function canAccessProperty(member: OrgMember, propertyId: ID): boolean {
  if (member.status !== 'active') return false;
  return member.propertyIds === null || member.propertyIds.includes(propertyId);
}

export function can(member: OrgMember | null | undefined, permission: StaffPermission, propertyId?: ID): boolean {
  if (!member) return false;
  if (propertyId && !canAccessProperty(member, propertyId)) return false;
  return permissionsOf(member).has(permission);
}

export function canOwnerOnly(member: OrgMember | null | undefined, _action: OwnerOnlyAction): boolean {
  return !!member && member.status === 'active' && member.role === 'owner';
}

export function isPlatformAdmin(actor: Actor): boolean {
  return actor.platformRole === 'platform_admin';
}

/** Support can read across tenants but cannot mutate verification/financial state. */
export function isPlatformStaff(actor: Actor): boolean {
  return actor.platformRole === 'platform_admin' || actor.platformRole === 'platform_support';
}

export const STAFF_PERMISSION_LABEL: Record<StaffPermission, string> = {
  'inventory.read': 'View rooms & beds',
  'inventory.write': 'Edit rooms & beds',
  'residents.read': 'View residents',
  'residents.write': 'Manage residents',
  'rent.read': 'View rent',
  'rent.collect': 'Record payments',
  'maintenance.read': 'View maintenance',
  'maintenance.write': 'Update maintenance',
  'notices.write': 'Send notices',
  'leads.read': 'View leads',
  'leads.write': 'Manage leads',
  'listings.publish': 'List / unlist rooms',
  'earnings.read': 'View service earnings',
};
