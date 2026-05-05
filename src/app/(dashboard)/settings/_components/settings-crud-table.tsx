"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export interface CrudItem {
  id: string;
  name: string;
  usageCount?: number; // optional: how many linked records
}

interface Props {
  title: string;
  description?: string;
  items: CrudItem[];
  onCreate: (formData: FormData) => Promise<void>;
  onRename: (id: string, formData: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  unit?: string;       // singular noun for "item", e.g. "category", "unit"
  usageLabel?: string; // what usageCount refers to, e.g. "product", "expense"
}

export function SettingsCrudTable({
  title,
  description,
  items,
  onCreate,
  onRename,
  onDelete,
  unit = "item",
  usageLabel = "product",
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const addRef  = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onCreate(fd);
        (e.target as HTMLFormElement).reset();
        addRef.current?.focus();
        toast.success(`${unit.charAt(0).toUpperCase() + unit.slice(1)} created.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleRename(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onRename(id, fd);
        setEditingId(null);
        toast.success("Renamed successfully.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to rename.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await onDelete(id);
        toast.success(`"${name}" deleted.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-1 pb-4">
        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 mb-2">
            {error}
          </div>
        )}

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No {unit}s yet.</p>
        )}

        {/* Item list */}
        {items.map((item) =>
          editingId === item.id ? (
            <form
              key={item.id}
              onSubmit={(e) => handleRename(item.id, e)}
              className="flex items-center gap-2"
            >
              <input
                ref={editRef}
                name="name"
                defaultValue={item.name}
                autoFocus
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="p-1.5 rounded-md hover:bg-muted text-emerald-600 disabled:opacity-50"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { setEditingId(null); setError(null); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
            >
              <span className="flex-1 text-sm">{item.name}</span>
              {item.usageCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {item.usageCount} {item.usageCount === 1 ? usageLabel : `${usageLabel}s`}
                </span>
              )}
              <button
                onClick={() => { setEditingId(item.id); setError(null); }}
                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(item.id, item.name)}
                disabled={pending}
                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        )}

        {/* Add new */}
        <form
          onSubmit={handleCreate}
          className="flex items-center gap-2 pt-3 border-t border-border mt-2"
        >
          <input
            ref={addRef}
            name="name"
            placeholder={`New ${unit} name…`}
            required
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
