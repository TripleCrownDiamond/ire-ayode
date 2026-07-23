export type Module = "dashboard" | "forms" | "map" | "sync" | "admin";

export type ModulePermissions = {
  read: boolean;
  edit: boolean;
};

export type UserPermissions = Record<Module, ModulePermissions>;

export const MODULES: { key: Module; label: string }[] = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "forms", label: "Formulaires" },
  { key: "map", label: "Carte" },
  { key: "sync", label: "Synchronisation" },
  { key: "admin", label: "Administration" },
];

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: { read: false, edit: false },
  forms: { read: false, edit: false },
  map: { read: false, edit: false },
  sync: { read: false, edit: false },
  admin: { read: false, edit: false },
};

export function getAllTruePermissions(): UserPermissions {
  return Object.fromEntries(
    MODULES.map((m) => [m.key, { read: true, edit: true }])
  ) as UserPermissions;
}
