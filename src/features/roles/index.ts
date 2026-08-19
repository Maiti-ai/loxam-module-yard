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
  manageSettings: ["ADMIN"],
  manageModules: ["ADMIN"],
  manageRentals: ["ADMIN", "OFFICE"],
  moveModules: ["ADMIN", "FORKLIFT_DRIVER", "OFFICE", "PRODUCTION"],
  managePhotos: ["ADMIN", "OFFICE", "FORKLIFT_DRIVER", "PRODUCTION"],
  manageAirco: ["ADMIN", "OFFICE", "FORKLIFT_DRIVER"],
  updateAircoMaintenance: ["ADMIN", "OFFICE", "FORKLIFT_DRIVER", "PRODUCTION"],
} as const satisfies Record<string, readonly AppRole[]>;

export const DRIVER_HOME_ROLES: AppRole[] = ["FORKLIFT_DRIVER", "PRODUCTION"];

export const MANAGEMENT_HOME_ROLES: AppRole[] = ["ADMIN", "OFFICE"];

export function roleCan(
  role: AppRole | null | undefined,
  permission: keyof typeof ROLE_PERMISSIONS,
) {
  if (!role) {
    return false;
  }

  return (ROLE_PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export function canDeleteModulePhotos(role: AppRole | null | undefined) {
  // Temporary: same access as managing photos. Replace this helper with a
  // dedicated role matrix later without changing the delete action flow.
  return roleCan(role, "managePhotos");
}

export function isDriverRole(role: AppRole | null | undefined) {
  return role === "FORKLIFT_DRIVER" || role === "PRODUCTION";
}

export function isManagementRole(role: AppRole | null | undefined) {
  return role === "ADMIN" || role === "OFFICE";
}

export type {AppRole};
