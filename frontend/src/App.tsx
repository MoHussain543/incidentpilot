import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AnalysisWorkspace from "./components/AnalysisWorkspace";
import AppShell, { type AppView } from "./components/AppShell";
import AuthGate from "./components/AuthGate";
import LandingPage from "./components/LandingPage";
import ReportsPage from "./components/ReportsPage";
import { hasSupabaseConfig, supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [publicAuthView, setPublicAuthView] = useState<null | "sign-in" | "sign-up">(null);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) {
        setPublicAuthView(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!hasSupabaseConfig || !supabase) {
    return <SupabaseConfigNotice />;
  }

  if (!authReady) {
    return <LoadingShell message="Restoring your session." />;
  }

  if (!session) {
    if (publicAuthView) {
      return (
        <AuthGate
          key={publicAuthView}
          initialMode={publicAuthView}
          onBack={() => setPublicAuthView(null)}
        />
      );
    }

    return (
      <LandingPage
        onSignIn={() => setPublicAuthView("sign-in")}
        onSignUp={() => setPublicAuthView("sign-up")}
      />
    );
  }

  return (
    <SignedInApp
      userId={session.user.id}
      userEmail={session.user.email ?? "Signed-in user"}
    />
  );
}

function SignedInApp({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [activeView, setActiveView] = useState<AppView>("analysis");
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);

  async function handleSignOut() {
    await supabase?.auth.signOut();
  }

  return (
    <AppShell
      activeView={activeView}
      userEmail={userEmail}
      onNavigate={setActiveView}
      onSignOut={handleSignOut}
    >
      {activeView === "analysis" ? (
        <AnalysisWorkspace
          userId={userId}
          userEmail={userEmail}
          onIncidentSaved={() => setReportsRefreshKey((current) => current + 1)}
        />
      ) : (
        <ReportsPage userId={userId} refreshKey={reportsRefreshKey} />
      )}
    </AppShell>
  );
}

function SupabaseConfigNotice() {
  return (
    <main className="app-shell app-shell--auth">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />
      <section className="auth-layout">
        <div className="auth-copy">
          <p className="eyebrow">Supabase setup</p>
          <h1>IncidentPilot</h1>
          <p className="hero-copy">
            Supabase auth is not configured yet. Add the publishable frontend credentials locally, then reload the app.
          </p>
        </div>

        <section className="panel panel--auth">
          <div className="panel__header panel__header--stacked">
            <div>
              <p className="panel__eyebrow">Missing environment variables</p>
              <h2>Frontend config needed</h2>
            </div>
          </div>
          <pre className="config-block">VITE_SUPABASE_URL=...\nVITE_SUPABASE_PUBLISHABLE_KEY=...\nVITE_API_BASE_URL=http://localhost:8080</pre>
        </section>
      </section>
    </main>
  );
}

function LoadingShell({ message }: { message: string }) {
  return (
    <main className="app-shell app-shell--auth">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />
      <section className="auth-layout">
        <section className="panel panel--auth">
          <div className="loading-panel">
            <div className="loading-panel__line" />
            <div className="loading-panel__line loading-panel__line--medium" />
            <div className="loading-panel__line loading-panel__line--short" />
            <p>{message}</p>
          </div>
        </section>
      </section>
    </main>
  );
}
