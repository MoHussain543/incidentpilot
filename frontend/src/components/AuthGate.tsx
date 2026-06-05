import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../supabase";
import Field from "./Field";
import PublicNav from "./PublicNav";

type AuthGateProps = {
  initialMode: "sign-in" | "sign-up";
  onBack: () => void;
};

export default function AuthGate({ initialMode, onBack }: AuthGateProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    mode === "sign-in"
      ? "Sign in to open your saved incidents and triage workspace."
      : "Create an account to save incidents and make IncidentPilot a real workspace."
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password
        });
        if (error) {
          throw error;
        }

        if (!data.session) {
          setNotice("Check your email to confirm your account, then come back and sign in.");
        } else {
          setNotice("Account created. You are now signed in.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((current) => {
      const next = current === "sign-in" ? "sign-up" : "sign-in";
      setErrorMessage(null);
      setNotice(
        next === "sign-in"
          ? "Sign in to open your saved incidents and triage workspace."
          : "Use a strong password. Supabase will create the linked profile record automatically."
      );
      return next;
    });
  }

  return (
    <div className="landing landing--auth">
      <div className="landing__backdrop landing__backdrop--glow" aria-hidden="true" />

      <PublicNav
        active="auth"
        onHome={onBack}
        onSignIn={() => setMode("sign-in")}
        onSignUp={() => setMode("sign-up")}
      />

      <main className="landing__main landing__main--auth">
        <button className="landing-back-link" type="button" onClick={onBack}>
          ← Back to home
        </button>

        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">Incident triage SaaS</p>
            <h1>IncidentPilot</h1>
            <p className="hero-copy">
              Sign in to save incident investigations, build history over time, and turn structured triage into a
              persistent ops workspace.
            </p>
            <ul className="auth-copy__list">
              <li>Secure session handling with Supabase Auth</li>
              <li>Saved incidents, versioned reports, and account-level history</li>
              <li>The AI triage workflow unlocks immediately once you are signed in</li>
            </ul>
          </div>

          <section className="panel panel--auth">
            <div className="panel__header panel__header--stacked">
              <div>
                <p className="panel__eyebrow">{mode === "sign-in" ? "Welcome back" : "Create your workspace"}</p>
                <h2>{mode === "sign-in" ? "Sign in" : "Create account"}</h2>
              </div>
              <p className="panel__helper">{notice}</p>
            </div>

            {errorMessage ? (
              <div className="message-banner message-banner--error" role="alert">
                <strong>Authentication issue</strong>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit}>
              <Field
                id="auth-email"
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
              />
              <Field
                id="auth-password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Choose a strong password"
              />

              <div className="panel__actions panel__actions--stacked">
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
                </button>
                <button className="secondary-button secondary-button--compact" type="button" onClick={switchMode}>
                  {mode === "sign-in" ? "Need an account?" : "Already have an account?"}
                </button>
              </div>
            </form>
          </section>
        </section>
      </main>
    </div>
  );
}
