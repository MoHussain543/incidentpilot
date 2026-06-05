import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AnalysisWorkspace from "./components/AnalysisWorkspace";
import AppShell, { type AppView } from "./components/AppShell";
import AuthGate from "./components/AuthGate";
import InvestigationSession from "./components/InvestigationSession";
import LandingPage from "./components/LandingPage";
import ReportsPage from "./components/ReportsPage";
import type { SavedIncidentDetail } from "./incidentDetail";
import { hasSupabaseConfig, supabase } from "./supabase";

export default function App() {
  const previewDetail = resolvePreviewInvestigation();

  if (previewDetail) {
    return (
      <PreviewInvestigationPage
        detail={previewDetail}
        onExit={() => {
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", window.location.pathname);
            window.location.reload();
          }
        }}
      />
    );
  }

  return <AppContent />;
}

function AppContent() {
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
    <div className="landing landing--auth">
      <div className="landing__backdrop landing__backdrop--grid" aria-hidden="true" />
      <div className="landing__backdrop landing__backdrop--glow" aria-hidden="true" />
      <main className="landing__main landing__main--auth page-enter">
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
    </div>
  );
}

function LoadingShell({ message }: { message: string }) {
  return (
    <div className="landing landing--auth">
      <div className="landing__backdrop landing__backdrop--grid" aria-hidden="true" />
      <div className="landing__backdrop landing__backdrop--glow" aria-hidden="true" />
      <main className="landing__main landing__main--auth page-enter">
        <section className="auth-layout auth-layout--centered">
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
    </div>
  );
}

function PreviewInvestigationPage({
  detail,
  onExit
}: {
  detail: SavedIncidentDetail;
  onExit: () => void;
}) {
  return (
    <div className="signed-in-shell">
      <div className="signed-in-shell__backdrop signed-in-shell__backdrop--grid" aria-hidden="true" />
      <div className="signed-in-shell__backdrop signed-in-shell__backdrop--glow" aria-hidden="true" />
      <main className="signed-in-shell__content page-enter">
        <InvestigationSession
          userId="preview-user"
          detail={detail}
          backLabel="Back to landing page"
          onBack={onExit}
          canRefine={false}
        />
      </main>
    </div>
  );
}

function resolvePreviewInvestigation(): SavedIncidentDetail | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") !== "investigation") {
    return null;
  }

  return {
    id: "preview-incident",
    createdAt: "2026-06-05T10:20:00.000Z",
    updatedAt: "2026-06-05T10:42:00.000Z",
    latestVersion: 3,
    context: {
      title: "Checkout failures after config rollout",
      serviceName: "payments-api",
      environment: "production",
      alertMessage: "HTTP 500 rate crossed 18% on /checkout within 4 minutes of build 204 shipping.",
      logsOrStackTrace:
        "java.net.UnknownHostException: db.internal\nat com.acme.payments.DbConnector.open(DbConnector.java:91)\nrequest_id=9a7fd0f2 region=us-east-1 pod=payments-api-67f5db9",
      recentDeployNotes:
        "Build 204 rotated database connection settings and updated the payment adapter image. Canary expanded from 10% to 100% at 10:14 ET."
    },
    reports: [
      {
        version: 3,
        createdAt: "2026-06-05T10:42:00.000Z",
        followUpAnswers: [
          {
            question: "Did the failure rate start immediately after the deploy?",
            answer: "Yes. The spike started within four minutes of the rollout reaching 100%."
          },
          {
            question: "Do healthy pods resolve db.internal correctly?",
            answer: "Healthy pods on the previous image resolve it, but pods on build 204 do not."
          }
        ],
        report: {
          summary:
            "The latest evidence points to build 204 shipping a bad database host or resolver path in the payment adapter, which is causing checkout requests to fail during connection setup.",
          severity: "HIGH",
          suspectedComponent: "payment-adapter",
          probableCauses: [
            "DATABASE_HOST or resolver config changed in build 204",
            "The new image is missing the runtime dependency that resolves internal DNS",
            "The canary expansion promoted a misconfigured secret to the full fleet"
          ],
          nextSteps: [
            "Diff build 204 config and secrets against the last healthy release",
            "Roll back the payment adapter deployment or pin traffic to healthy pods",
            "Exec into one failing pod and verify DNS resolution for db.internal",
            "Confirm whether secret refresh or init container behavior changed in this rollout"
          ],
          confidence: 0.91,
          clarifyingQuestions: []
        }
      },
      {
        version: 2,
        createdAt: "2026-06-05T10:31:00.000Z",
        followUpAnswers: [
          {
            question: "Did the failure rate start immediately after the deploy?",
            answer: "It started soon after the rollout, but we had not yet confirmed exact timing."
          }
        ],
        report: {
          summary:
            "The incident likely sits in the payment adapter or its database connectivity path, with recent rollout activity as the leading trigger.",
          severity: "HIGH",
          suspectedComponent: "payment-adapter",
          probableCauses: [
            "A rollout changed how the adapter reaches the database",
            "Pods are failing DNS resolution intermittently"
          ],
          nextSteps: [
            "Compare rollout timing with error-rate graphs",
            "Check whether only new pods are failing"
          ],
          confidence: 0.79,
          clarifyingQuestions: ["Do healthy pods resolve db.internal correctly?"]
        }
      },
      {
        version: 1,
        createdAt: "2026-06-05T10:20:00.000Z",
        followUpAnswers: null,
        report: {
          summary:
            "Checkout 500s appear tied to a database connectivity failure in the payments path, but the root cause is still broad.",
          severity: "MEDIUM",
          suspectedComponent: "payments-api",
          probableCauses: ["Database host mismatch", "DNS instability", "A recent deploy introduced config drift"],
          nextSteps: ["Inspect stack traces", "Compare the latest deploy against the last good release"],
          confidence: 0.66,
          clarifyingQuestions: ["Did the failure rate start immediately after the deploy?"]
        }
      }
    ]
  };
}
