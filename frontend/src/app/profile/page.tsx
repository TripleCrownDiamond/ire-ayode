"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Lock,
  Calendar,
  Clock,
  Trash2,
  ShieldCheck,
  Loader2,
  Save,
  AlertTriangle,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailChanged, setEmailChanged] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Messages
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNewEmail(data.email || "");
      }
    } catch {
      console.error("Failed to load profile");
    }
    setLoading(false);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || newEmail === profile.email) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Erreur lors de la mise à jour de l'email");
      return;
    }

    setSuccess("Email mis à jour. Vérifiez votre boîte de réception pour confirmer.");
    setEmailChanged(false);
    fetchProfile();
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) return;

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Erreur lors de la mise à jour du mot de passe");
      return;
    }

    setSuccess("Mot de passe mis à jour avec succès.");
    setPasswordChanged(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError("");

    const res = await fetch("/api/profile", { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Erreur lors de la suppression");
      setDeleting(false);
      return;
    }

    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Impossible de charger le profil.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          Mon profil
        </h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos informations personnelles et votre sécurité
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Infos du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Email</div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.email}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Rôle</div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <Badge variant={profile.is_admin ? "default" : "secondary"}>
                  {profile.is_admin ? "Administrateur" : "Utilisateur"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Inscrit le</div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(profile.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Dernière connexion</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {profile.last_sign_in_at
                    ? new Date(profile.last_sign_in_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Jamais"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modifier l'email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Modifier l&apos;email
          </CardTitle>
          <CardDescription>
            Un email de confirmation sera envoyé à la nouvelle adresse.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailChanged(e.target.value !== profile.email);
                }}
                placeholder="nouvel@email.com"
              />
            </div>
            <Button
              onClick={handleUpdateEmail}
              disabled={saving || !emailChanged}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauvegarder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modifier le mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>
            Choisissez un mot de passe fort d&apos;au moins 6 caractères.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nouveau mot de passe</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordChanged(e.target.value.length > 0);
              }}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Confirmer le mot de passe</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            onClick={handleUpdatePassword}
            disabled={saving || !passwordChanged || !confirmPassword}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* Zone dangereuse */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Zone dangereuse
          </CardTitle>
          <CardDescription>
            Actions irréversibles sur votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="gap-2"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? "Suppression..." : "Oui, supprimer mon compte"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer mon compte
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
