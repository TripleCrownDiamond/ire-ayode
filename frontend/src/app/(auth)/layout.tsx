export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6">
      {/* Motif de fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 h-64 w-64 rounded-full bg-amber-500/5 blur-2xl" />
        {/* Grille subtile */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.015]">
          <defs>
            <pattern id="auth-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
      </div>

      <div className="relative w-full max-w-md animate-in fade-in duration-700">
        {/* Logo et branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 mb-5 ring-1 ring-white/20">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22V12a10 10 0 0 1 10-10" />
              <path d="M22 22V12a10 10 0 0 0-10-10" />
              <path d="M12 2v20" />
              <path d="M2 12h20" />
              <path d="M2 17h20" />
              <path d="M2 22h20" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ire Ayode</h1>
          <p className="text-sm text-muted-foreground/80 mt-1.5 font-medium tracking-wide">
            Plateforme agricole
          </p>
        </div>

        {children}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          &copy; {new Date().getFullYear()} Ire Ayode &mdash; Tous droits réservés
        </p>
      </div>
    </div>
  );
}
