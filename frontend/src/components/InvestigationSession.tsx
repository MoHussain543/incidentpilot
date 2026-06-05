import { useState } from "react";
import { ApiError, refineIncident } from "../api";
import { fetchSavedIncidentDetail, type SavedIncidentDetail } from "../incidentDetail";
import { persistRefineResult } from "../incidentPersistence";
import { supabase } from "../supabase";
import type { AnalyzeIncidentRequest, IncidentTriageReport } from "../types";
import {
  createEmptyAnswers,
  createMarkdownReport,
  resolveAssistantState,
  resolvePersistenceWarning,
  slugify,
  type RequestPhase
} from "../workspaceShared";
import AnalyzingOverlay from "./AnalyzingOverlay";
import IncidentDetailView from "./IncidentDetailView";

type InvestigationSessionProps = {
  userId: string;
  detail: SavedIncidentDetail;
  backLabel: string;
  onBack: () => void;
  onIncidentUpdated?: () => void;
  initialPersistWarning?: string | null;
  canRefine?: boolean;
};

export default function InvestigationSession({
  userId,
  detail: initialDetail,
  backLabel,
  onBack,
  onIncidentUpdated,
  initialPersistWarning = null,
  canRefine = true
}: InvestigationSessionProps) {
  const [detail, setDetail] = useState(initialDetail);
  const [selectedReportVersion, setSelectedReportVersion] = useState(initialDetail.latestVersion);
  const [report, setReport] = useState<IncidentTriageReport>(
    () => initialDetail.reports.find((entry) => entry.version === initialDetail.latestVersion)?.report ?? initialDetail.reports[0]!.report
  );
  const [lastSubmittedIncident, setLastSubmittedIncident] = useState<AnalyzeIncidentRequest>(initialDetail.context);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("success");
  const [apiError, setApiError] = useState<string | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>(() =>
    createEmptyAnswers(report.clarifyingQuestions)
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [persistWarning, setPersistWarning] = useState<string | null>(initialPersistWarning);
  const [detailLoading, setDetailLoading] = useState(false);

  const assistantState = resolveAssistantState(requestPhase, report?.severity, apiError);
  const busy = requestPhase === "refining";
  const refinementEnabled = canRefine && detail.id !== "ephemeral";

  function applyReportVersion(nextDetail: SavedIncidentDetail, version: number) {
    const entry = nextDetail.reports.find((reportVersion) => reportVersion.version === version);
    if (!entry) {
      return;
    }

    setSelectedReportVersion(version);
    setLastSubmittedIncident(nextDetail.context);
    setReport(entry.report);
    setFollowUpAnswers(createEmptyAnswers(entry.report.clarifyingQuestions));
    setRequestPhase("success");
    setApiError(null);
  }

  async function reloadDetail(incidentId: string) {
    if (!supabase || incidentId === "ephemeral") {
      return;
    }

    const nextDetail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
    setDetail(nextDetail);
    applyReportVersion(nextDetail, nextDetail.latestVersion);
  }

  function handleSelectReportVersion(version: number) {
    applyReportVersion(detail, version);
  }

  async function handleRefineSubmit() {
    if (!lastSubmittedIncident || !report) {
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

    if (!refinementEnabled) {
      setApiError("This analysis is not linked to a saved incident yet. Re-run the analysis before refining.");
      setStatusMessage("Refine requires a saved incident record.");
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
          await persistRefineResult(supabase, userId, detail.id, nextReport, answers);
          onIncidentUpdated?.();
          setDetailLoading(true);
          await reloadDetail(detail.id);
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
    try {
      await navigator.clipboard.writeText(report.summary);
      setStatusMessage("Summary copied to clipboard.");
    } catch {
      setApiError("Could not copy the summary. Your browser may be blocking clipboard access.");
      setStatusMessage("Copy to clipboard failed.");
    }
  }

  return (
    <>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      {busy ? <AnalyzingOverlay phase="refining" incidentTitle={detail.context.title} /> : null}

      <IncidentDetailView
        detail={detail}
        selectedVersion={selectedReportVersion}
        report={report}
        assistantState={assistantState}
        busy={busy}
        requestPhase={requestPhase}
        followUpAnswers={followUpAnswers}
        apiError={apiError}
        persistWarning={persistWarning}
        detailLoading={detailLoading}
        onBack={onBack}
        backLabel={backLabel}
        onSelectVersion={handleSelectReportVersion}
        onFollowUpChange={updateFollowUp}
        onRefine={refinementEnabled ? handleRefineSubmit : undefined}
        onCopySummary={copySummary}
        onExportMarkdown={exportMarkdown}
      />
    </>
  );
}
