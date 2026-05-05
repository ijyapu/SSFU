"use client";

import { useState, useMemo, useTransition } from "react";
import Image from "next/image";
import { DateDisplay } from "@/components/ui/date-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { setUserRole, deleteUser } from "../actions";
import type { AppRole } from "@/types/globals";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";

export interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  imageUrl: string;
  role: AppRole | null;
  createdAt: string;
  isCurrentUser: boolean;
}

interface Props {
  users: UserRow[];
  currentRole: AppRole | null;
}

const ALL_ROLES: { value: AppRole | "none"; label: string; color: string }[] = [
  { value: "none",       label: "No access",   color: "text-muted-foreground" },
  { value: "employee",   label: "Employee",    color: "text-foreground" },
  { value: "accountant", label: "Accountant",  color: "text-blue-600" },
  { value: "manager",    label: "Manager",     color: "text-purple-600" },
  { value: "admin",      label: "Admin",       color: "text-emerald-600" },
  { value: "superadmin", label: "Superadmin",  color: "text-amber-600" },
];

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  admin:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  manager:    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  accountant: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  employee:   "bg-muted text-muted-foreground",
};

function Avatar({ src, name }: { src: string; name: string }) {
  return (
    <Image
      src={src}
      alt={name}
      width={32}
      height={32}
      className="h-8 w-8 rounded-full object-cover shrink-0"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function RoleSelect({
  userId,
  current,
  isCurrentUser,
  isSuperAdmin,
  targetIsSuperAdmin,
}: {
  userId: string;
  current: AppRole | null;
  isCurrentUser: boolean;
  isSuperAdmin: boolean;
  targetIsSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Regular admins cannot touch superadmin accounts at all
  const locked = !isSuperAdmin && targetIsSuperAdmin;

  const visibleRoles = ALL_ROLES.filter(
    (r) => r.value !== "superadmin" || isSuperAdmin
  );

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as AppRole | "none";
    setError(null);
    startTransition(async () => {
      try {
        await setUserRole(userId, newRole);
        toast.success("Role updated successfully.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update role.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const isDisabled = pending || isCurrentUser || locked;
  let title: string | undefined;
  if (isCurrentUser) title = "You cannot change your own role";
  else if (locked)   title = "Only superadmins can change this user's role";

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={current ?? "none"}
        onChange={handleChange}
        disabled={isDisabled}
        title={title}
        className={`rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed ${pending ? "opacity-60" : ""}`}
      >
        {visibleRoles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive max-w-50 text-right">{error}</p>}
    </div>
  );
}

function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUser(userId);
        toast.success(`${name} has been removed.`);
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete user.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        title="Delete user"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{name}</strong> from the system.
              They will lose all access immediately and cannot be recovered.
              Any data they created (orders, expenses, etc.) is retained for record-keeping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Yes, delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function UserRoleTable({ users, currentRole }: Props) {
  const { sortKey, sortDir, toggle } = useSortable("fullName");
  const isSuperAdmin   = currentRole === "superadmin";
  const noAccessCount  = users.filter((u) => !u.role).length;
  const superAdminCount = users.filter((u) => u.role === "superadmin").length;

  const sorted = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => {
      const aVals: Record<string, string | number> = { fullName: a.fullName ?? a.email, email: a.email, createdAt: a.createdAt, role: a.role ?? "" };
      const bVals: Record<string, string | number> = { fullName: b.fullName ?? b.email, email: b.email, createdAt: b.createdAt, role: b.role ?? "" };
      return compareValues(aVals[sortKey], bVals[sortKey], sortDir);
    });
  }, [users, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle>Users & Roles</CardTitle>
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
              <ShieldCheck className="h-3 w-3" />
              Superadmin view
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {users.length} user{users.length !== 1 ? "s" : ""} total
          {noAccessCount > 0 && (
            <span className="ml-2 text-amber-600">· {noAccessCount} without a role</span>
          )}
          {superAdminCount > 0 && (
            <span className="ml-2 text-amber-600">· {superAdminCount} superadmin{superAdminCount !== 1 ? "s" : ""}</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            {(() => { const sp = { sortKey, sortDir, toggle }; return (
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="fullName"  label="User"         {...sp} /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell"><SortButton col="createdAt" label="Joined" {...sp} /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"><SortButton col="role"      label="Current role" {...sp} /></th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                {isSuperAdmin ? "Actions" : "Change role"}
              </th>
            </tr>
            ); })()}
          </thead>
          <tbody>
            {sorted.map((user) => {
              const targetIsSuperAdmin = user.role === "superadmin";
              const displayName = user.fullName ?? user.email;
              return (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={user.imageUrl} name={displayName} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {user.fullName ?? <span className="text-muted-foreground italic">No name</span>}
                          {user.isCurrentUser && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                    <DateDisplay date={user.createdAt} fmt="d MMM yyyy" />
                  </td>
                  <td className="px-4 py-3">
                    {user.role ? (
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                        {user.role === "superadmin" && <ShieldCheck className="h-3 w-3" />}
                        {user.role}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">No access</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin && !user.isCurrentUser && (
                        <DeleteUserButton userId={user.id} name={displayName} />
                      )}
                      <RoleSelect
                        userId={user.id}
                        current={user.role}
                        isCurrentUser={user.isCurrentUser}
                        isSuperAdmin={isSuperAdmin}
                        targetIsSuperAdmin={targetIsSuperAdmin}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
