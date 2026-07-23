"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff, Mail, Lock, ShieldAlert } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl shadow-black/5 ring-1 ring-black/5 p-7 sm:p-8 text-center animate-in fade-in duration-500">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 mb-5 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-semibold">Compte créé !</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
          Votre compte a été créé avec succès. Un administrateur doit activer vos accès avant que vous puissiez utiliser la plateforme.
        </p>
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/60 p-3.5 text-xs text-amber-800 mt-5 text-left">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Votre compte est en attente d&apos;activation par un administrateur. Vous recevrez un accès dès que vos permissions seront configurées.</span>
        </div>
        <Link href="/login">
          <Button variant="outline" className="mt-6 rounded-xl h-11 px-6">
            Retour à la connexion
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl shadow-black/5 ring-1 ring-black/5 p-7 sm:p-8">
      <div className="text-center mb-7">
        <h2 className="text-xl font-semibold tracking-tight">Créer un compte</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Inscrivez-vous pour accéder à la plateforme
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Avertissement */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3 text-xs text-amber-700">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Important :</strong> Après inscription, vous n&apos;aurez accès à rien.
            Un administrateur doit activer vos permissions pour chaque module.
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground/90">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={loading}
              className="pl-10 h-11 rounded-xl border-muted/60 bg-muted/30 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground/90">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              className="pl-10 pr-10 h-11 rounded-xl border-muted/60 bg-muted/30 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/90">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              className="pl-10 h-11 rounded-xl border-muted/60 bg-muted/30 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl gap-2 text-sm font-medium shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 transition-all duration-200"
          size="lg"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {loading ? "Inscription en cours..." : "Créer mon compte"}
        </Button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted/60" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
