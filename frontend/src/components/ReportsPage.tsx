import { useCallback, useEffect, useState } from "react";
import {
  fetchSavedIncidentDetail,
  type SavedIncidentDetail
} from "../incidentDetail";
import {
  fetchSavedIncidents,
  type SavedIncidentSummary
} from "../incidentHistory";
import { supabase } from "../supabase";
import { resolveHistoryError } from "../workspaceShared";
import InvestigationSession from "./InvestigationSession";
import ReportsDashboard from "./ReportsDashboard";

type ReportsPageProps = {
  userId: string;
  refreshKey: number;
};

export default function ReportsPage({ userId, refreshKey }: ReportsPageProps) {
  const [savedIncidents, setSavedIncidents] = useState<SavedIncidentSummary[]>([]);
  const [historyPhase, setHistoryPhase] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openedIncidentDetail, setOpenedIncidentDetail] = useState<SavedIncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const viewingDetail = Boolean(openedIncidentDetail);

  const refreshHistory = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setHistoryPhase("loading");
    setHistoryError(null);

    try {
      const incidents = await fetchSavedIncidents(supabase, userId);
      setSavedIncidents(incidents);
      setHistoryPhase("ready");
    } catch (error) {
      setHistoryPhase("error");
      setHistoryError(resolveHistoryError(error));
    }
  }, [userId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory, refreshKey]);

  async function handleOpenIncident(incidentId: string) {
    if (!supabase) {
      return;
    }

    setDetailLoading(true);
    setOpenError(null);

    try {
      const detail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
      setOpenedIncidentDetail(detail);
    } catch (error) {
      setOpenedIncidentDetail(null);
      setOpenError(resolveHistoryError(error));
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCloseDetail() {
    setOpenedIncidentDetail(null);
    setOpenError(null);
  }

  if (viewingDetail && openedIncidentDetail) {
    return (
      <InvestigationSession
        key={openedIncidentDetail.id}
        userId={userId}
        detail={openedIncidentDetail}
        backLabel="Back to all reports"
        onBack={handleCloseDetail}
        onIncidentUpdated={refreshHistory}
      />
    );
  }

  return (
    <div className="workspace-page workspace-page--reports">
      <section className="workspace-page-header">
        <div>
          <p className="eyebrow">Saved investigations</p>
          <h1>Reports</h1>
          <p className="workspace-page-header__lede">
            Your account-wide library of analyzed incidents — open any report to continue the investigation.
          </p>
        </div>
        <div className="workspace-page-header__status">
          <span className="status-pill status-pill--ready">Report library</span>
          <p className="workspace-page-header__note">
            {savedIncidents.length > 0
              ? `${savedIncidents.length} saved incident${savedIncidents.length === 1 ? "" : "s"} in your account.`
              : "No saved reports yet. Run an analysis to populate this library."}
          </p>
        </div>
      </section>

      {openError ? (
        <div className="message-banner message-banner--error" role="alert">
          <strong>Could not open incident</strong>
          <p>{openError}</p>
        </div>
      ) : null}

      {detailLoading ? (
        <div className="loading-panel" aria-live="polite">
          <div className="loading-panel__line" />
          <div className="loading-panel__line loading-panel__line--medium" />
          <div className="loading-panel__line loading-panel__line--short" />
          <p>Loading saved incident...</p>
        </div>
      ) : (
        <ReportsDashboard
          incidents={savedIncidents}
          phase={historyPhase}
          errorMessage={historyError}
          onRefresh={refreshHistory}
          onSelectIncident={handleOpenIncident}
        />
      )}
    </div>
  );
}
