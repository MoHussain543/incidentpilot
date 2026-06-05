import { useCallback, useEffect, useState } from "react";
import { ApiError, refineIncident } from "../api";
import {
  fetchSavedIncidentDetail,
  type SavedIncidentDetail
} from "../incidentDetail";
import {
  fetchSavedIncidents,
  type SavedIncidentSummary
} from "../incidentHistory";
import { persistRefineResult } from "../incidentPersistence";
import { supabase } from "../supabase";
import type { AnalyzeIncidentRequest, IncidentTriageReport } from "../types";
import {
  createEmptyAnswers,
  createMarkdownReport,
  resolveAssistantState,
  resolveHistoryError,
  resolvePersistenceWarning,
  slugify,
  statusLabel,
  type RequestPhase
} from "../workspaceShared";
import IncidentDetailView from "./IncidentDetailView";
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
  const [selectedReportVersion, setSelectedReportVersion] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [report, setReport] = useState<IncidentTriageReport | null>(null);
  const [lastSubmittedIncident, setLastSubmittedIncident] = useState<AnalyzeIncidentRequest | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [persistWarning, setPersistWarning] = useState<string | null>(null);

  const assistantState = resolveAssistantState(requestPhase, report?.severity, apiError);
  const busy = requestPhase === "refining";
  const viewingDetail = Boolean(openedIncidentDetail && selectedReportVersion !== null && report);

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

  function applyReportVersion(detail: SavedIncidentDetail, version: number) {
    const entry = detail.reports.find((reportVersion) => reportVersion.version === version);
    if (!entry) {
      return;
    }

    setSelectedReportVersion(version);
    setLastSubmittedIncident(detail.context);
    setReport(entry.report);
    setFollowUpAnswers(createEmptyAnswers(entry.report.clarifyingQuestions));
    setRequestPhase("success");
    setApiError(null);
  }

  async function reloadOpenedIncident(incidentId: string) {
    if (!supabase) {
      return;
    }

    const detail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
    setOpenedIncidentDetail(detail);
    applyReportVersion(detail, detail.latestVersion);
  }

  async function handleOpenIncident(incidentId: string) {
    if (!supabase) {
      return;
    }

    setDetailLoading(true);
    setApiError(null);
    setPersistWarning(null);

    try {
      const detail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
      setOpenedIncidentDetail(detail);
      applyReportVersion(detail, detail.latestVersion);
      setStatusMessage(`Opened saved incident: ${detail.context.title}`);
    } catch (error) {
      setOpenedIncidentDetail(null);
      setSelectedReportVersion(null);
      setReport(null);
      setApiError(resolveHistoryError(error));
      setStatusMessage("Could not open the saved incident.");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCloseDetail() {
    setOpenedIncidentDetail(null);
    setSelectedReportVersion(null);
    setDetailLoading(false);
    setReport(null);
    setLastSubmittedIncident(null);
    setFollowUpAnswers({});
    setRequestPhase("idle");
    setApiError(null);
    setPersistWarning(null);
    setStatusMessage("Returned to report library.");
  }

  function handleSelectReportVersion(version: number) {
    if (!openedIncidentDetail) {
      return;
    }

    applyReportVersion(openedIncidentDetail, version);
  }

  async function handleRefineSubmit() {
    if (!lastSubmittedIncident || !report || !openedIncidentDetail) {
      return;
    }

    const answers = report.clarifyingQuestions
      .map((question, index) => ({
        question,
        answer: followUpAnswers[`${index}:${question}`]?.trim() ?? ""
      }))
      .filter((entry) => entry.answer.length > 0);

    if (answers.length === 0) {
      setApiError("Answer at least one follow-up question, or leave the rest blank and refine later.");
      setStatusMessage("Refine request needs at least one follow-up answer.");
      return;
    }

    setRequestPhase("refining");
    setApiError(null);
    setStatusMessage("Refining the incident report.");

    try {
      const nextReport = await refineIncident({
        originalIncident: lastSubmittedIncident,
        previousReport: report,
        followUpAnswers: answers
      });
      setReport(nextReport);
      setFollowUpAnswers(createEmptyAnswers(nextReport.clarifyingQuestions));
      setPersistWarning(null);

      if (supabase) {
        try {
          await persistRefineResult(supabase, userId, openedIncidentDetail.id, nextReport, answers);
          await refreshHistory();
          setDetailLoading(true);
          await reloadOpenedIncident(openedIncidentDetail.id);
          setDetailLoading(false);
        } catch (error) {
          setPersistWarning(resolvePersistenceWarning(error));
        }
      }

      setRequestPhase("success");
      setStatusMessage("Refined incident analysis is ready.");
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
      } else {
        setApiError("Refining the analysis failed.");
      }
      setRequestPhase("error");
      setStatusMessage("Refining the analysis failed.");
    }
  }

  function updateFollowUp(questionKey: string, answer: string) {
    setFollowUpAnswers((current) => ({
      ...current,
      [questionKey]: answer
    }));
  }

  function exportMarkdown() {
    if (!report || !lastSubmittedIncident) {
      return;
    }

    const markdown = createMarkdownReport(lastSubmittedIncident, report);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incidentpilot-${slugify(lastSubmittedIncident.title || "incident-report")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copySummary() {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(report.summary);
      setStatusMessage("Summary copied to clipboard.");
    } catch {
      setApiError("Could not copy the summary. Your browser may be blocking clipboard access.");
      setStatusMessage("Copy to clipboard failed.");
    }
  }

  return (
    <div className="workspace-page workspace-page--reports">
      <section className="workspace-page-header">
        <div>
          <p className="eyebrow">Saved investigations</p>
          <h1>Reports</h1>
          <p className="workspace-page-header__lede">
            {viewingDetail
              ? "Review incident context, browse report versions, and refine when new evidence arrives."
              : "Your account-wide library of analyzed incidents — open any report to continue the investigation."}
          </p>
        </div>
        <div className="workspace-page-header__status">
          <span className={`status-pill status-pill--${assistantState}`}>
            {viewingDetail
              ? statusLabel(requestPhase, report?.severity, apiError)
              : "Report library"}
          </span>
          <p className="workspace-page-header__note">
            {savedIncidents.length > 0
              ? `${savedIncidents.length} saved incident${savedIncidents.length === 1 ? "" : "s"} in your account.`
              : "No saved reports yet. Run an analysis to populate this library."}
          </p>
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      {!viewingDetail ? (
        <ReportsDashboard
          incidents={savedIncidents}
          phase={historyPhase}
          errorMessage={historyError}
          onRefresh={refreshHistory}
          onSelectIncident={handleOpenIncident}
        />
      ) : null}

      {viewingDetail && openedIncidentDetail && selectedReportVersion !== null && report ? (
        <IncidentDetailView
          detail={openedIncidentDetail}
          selectedVersion={selectedReportVersion}
          report={report}
          assistantState={assistantState}
          busy={busy}
          requestPhase={requestPhase}
          followUpAnswers={followUpAnswers}
          apiError={apiError}
          persistWarning={persistWarning}
          detailLoading={detailLoading}
          onBack={handleCloseDetail}
          backLabel="Back to all reports"
          onSelectVersion={handleSelectReportVersion}
          onFollowUpChange={updateFollowUp}
          onRefine={handleRefineSubmit}
          onCopySummary={copySummary}
          onExportMarkdown={exportMarkdown}
        />
      ) : null}
    </div>
  );
}
