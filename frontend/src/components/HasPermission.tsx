import React, { useContext } from "react";
import { PermissionsContext } from "../layouts/DashboardLayout";

interface HasPermissionProps {
  module: string;
  action: string;
  children?: React.ReactNode;
}

/**
 * Renders children only when permissions[module][action] is truthy.
 * If PermissionsContext is null/undefined (e.g. SuperAdmin or not loaded),
 * this component will render children (treat as allowed).
 */
const HasPermission: React.FC<HasPermissionProps> = ({ module, action, children }) => {
  const permissions = useContext(PermissionsContext);

  // If permissions context is not provided, assume allowed (SuperAdmin / fallback)
  if (!permissions) return <>{children}</>;

  const allowed = !!(permissions[module] && permissions[module][action]);

  return allowed ? <>{children}</> : null;
};

export default HasPermission;