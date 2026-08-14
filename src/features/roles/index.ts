import type {AppRole} from "@/types/database";

export const APP_ROLES: AppRole[] = [
  "ADMIN",
  "FORKLIFT_DRIVER",
  "OFFICE",
  "PRODUCTION",
];

export const ROLE_PERMISSIONS = {
  manageUsers: ["ADMIN"],
  manageYardLayout: ["ADMIN"],
  manageModules: ["ADMIN"],
  manageRentals: ["ADMIN", "OFFICE"],
  moveModules: ["ADMIN", "FORKLIFT_DRIVER"],
  managePhotos: ["ADMIN", "OFFICE"],
  manageAirco: ["ADMIN", "OFFICE"],
  updateAircoMaintenance: ["ADMIN", "OFFICE", "PRODUCTION"],
} as const satisfies Record<string, readonly AppRole[]>;

export function roleCan(
  role: AppRole | null | undefined,
  permission: keyof typeof ROLE_PERMISSIONS,
) {
  if (!role) {
    return false;
  }

  return (ROLE_PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export type {AppRole};
