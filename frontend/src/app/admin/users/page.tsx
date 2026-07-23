"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { MODULES } from "@/lib/permissions";
import type { Module } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Eye,
  EyeOff,
  Pencil,
  Loader2,
  Search,
  Users,
  RefreshCw,
  Trash2,
  Ban,
  CheckCircle,
  X,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_active: boolean;
  permissions: Record<string, { read: boolean; edit: boolean }>;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading, canRead, canEdit, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Nouvel utilisateur
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Confirmation suppression
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      console.error("Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
    else setLoading(false);
  }, [isAdmin, loadUsers]);

  const togglePermission = async (
    userId: string,
    module: Module,
    type: "read" | "edit",
    currentValue: boolean
  ) => {
    setSavingId(userId);
    const newValue = !currentValue;
    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: { [module]: { read: type === "read" ? newValue : currentValue, edit: type === "edit" ? newValue : currentValue } },
      }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                permissions: {
                  ...u.permissions,
                  [module]: { ...u.permissions[module], [type]: newValue },
                },
              }
            : u
        )
      );
    }
    setSavingId(null);
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    setSavingId(userId);
    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !current }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_admin: !current,
                permissions: !current
                  ? Object.fromEntries(
                      MODULES.map((m) => [m.key, { read: true, edit: true }])
                    ) as Record<string, { read: boolean; edit: boolean }>
                  : u.permissions,
              }
            : u
        )
      );
    }
    setSavingId(null);
  };

  const toggleActive = async (userId: string, current: boolean) => {
    setSavingId(userId);
    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_active: !current,
                permissions: !current
                  ? u.permissions
                  : Object.fromEntries(
                      MODULES.map((m) => [m.key, { read: false, edit: false }])
                    ) as Record<string, { read: boolean; edit: boolean }>,
              }
            : u
        )
      );
    }
    setSavingId(null);
  };

  const deleteUser = async (userId: string) => {
    setSavingId(userId);
    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setDeleteConfirmId(null);
    setSavingId(null);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!newEmail.trim() || !newPassword.trim()) {
      setAddError("Email et mot de passe requis.");
      return;
    }
    if (newPassword.length < 6) {
      setAddError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setAdding(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        is_admin: newIsAdmin,
      }),
    });
    setAdding(false);

    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Erreur lors de la création");
      return;
    }

    setNewEmail("");
    setNewPassword("");
    setNewIsAdmin(false);
    setShowAddForm(false);
    loadUsers();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canRead("admin")) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <div className="text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive/60" />
          <p>Accès refusé. Vous n&apos;avez pas les permissions nécessaires.</p>
        </div>
      </div>
    );
  }

  const filtered = search
    ? users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestion des utilisateurs
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les accès et les permissions de chaque utilisateur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5">
            {showAddForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showAddForm ? "Fermer" : "Ajouter"}
          </Button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Nouvel utilisateur
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleAddUser}>
            <CardContent className="p-6 space-y-4">
              {addError && (
                <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg flex items-center gap-2">
                  <span className="font-medium">{addError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    autoFocus
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mot de passe</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rôle</label>
                  <label className="flex items-center gap-2 h-10 px-3 rounded-md border hover:bg-muted transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsAdmin}
                      onChange={(e) => setNewIsAdmin(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Administrateur</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={adding} className="w-full gap-2 h-10">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {adding ? "Création..." : "Créer l'utilisateur"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="pl-9"
        />
      </div>

      {/* Liste des utilisateurs */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="p-6">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground mt-2">
              {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <Card
              key={u.id}
              className={`overflow-hidden ${
                u.id === user?.id ? "ring-1 ring-primary/20" : ""
              } ${u.is_active === false ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{u.email}</span>
                        {u.id === user?.id && (
                          <Badge variant="outline" className="text-[10px]">Vous</Badge>
                        )}
                        {u.is_admin && (
                          <Badge variant="default" className="text-[10px] bg-primary/10 text-primary border-primary/20">Admin</Badge>
                        )}
                        {u.is_active === false && (
                          <Badge variant="destructive" className="text-[10px]">Suspendu</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                        {u.last_sign_in_at && (
                          <> · Dernière connexion {new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {savingId === u.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1 rounded-md hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        checked={u.is_admin}
                        onChange={() => toggleAdmin(u.id, u.is_admin)}
                        disabled={savingId === u.id || u.id === user?.id}
                        className="rounded"
                      />
                      Admin
                    </label>
                    <button
                      onClick={() => toggleActive(u.id, u.is_active !== false)}
                      disabled={savingId === u.id || u.id === user?.id}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                      title={u.is_active === false ? "Activer" : "Suspendre"}
                    >
                      {u.is_active === false ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Ban className="h-4 w-4 text-orange-500" />
                      )}
                    </button>
                    {deleteConfirmId === u.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteUser(u.id)}
                          disabled={savingId === u.id}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          Confirmer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirmId(null)}
                          className="h-7 px-2 text-xs"
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(u.id)}
                        disabled={savingId === u.id || u.id === user?.id}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grille des permissions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                  {MODULES.map((mod) => {
                    const perm = u.permissions[mod.key] || { read: false, edit: false };
                    const isSaving = savingId === u.id;
                    return (
                      <div
                        key={mod.key}
                        className={`rounded-lg border p-2.5 text-xs transition-colors ${
                          u.is_admin
                            ? "bg-primary/5 border-primary/20 opacity-60"
                            : perm.read || perm.edit
                              ? "bg-green-50/50 border-green-200"
                              : "bg-muted/30 border-muted"
                        }`}
                      >
                        <div className="font-medium mb-1.5 text-muted-foreground">{mod.label}</div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => togglePermission(u.id, mod.key, "read", perm.read)}
                            disabled={isSaving || u.is_admin || u.is_active === false}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                              perm.read
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {perm.read ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            Lecture
                          </button>
                          <button
                            onClick={() => togglePermission(u.id, mod.key, "edit", perm.edit)}
                            disabled={isSaving || u.is_admin || u.is_active === false}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                              perm.edit
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {perm.edit ? <Pencil className="h-3 w-3" /> : <Pencil className="h-3 w-3 opacity-30" />}
                            Édition
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {u.is_admin && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    L&apos;administrateur a automatiquement accès à tous les modules en lecture et édition.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
