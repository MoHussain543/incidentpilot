package com.mohammed.incidentpilot.service;

import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.mohammed.incidentpilot.dto.AnalyzeIncidentRequest;
import com.mohammed.incidentpilot.dto.FollowUpAnswer;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.dto.RefineIncidentRequest;

@Component
public class IncidentPromptFactory {

	public String buildSystemInstructions() {
		return """
			You are IncidentPilot, an AI incident triage assistant for software teams.
			Analyze production incidents conservatively and return a structured JSON report.
			Base every conclusion only on the provided incident context. Do not invent services, metrics, deploys, or log lines that are not supported by the input.
			If the evidence is incomplete or ambiguous, say so plainly in the summary, lower confidence, and ask focused clarifying questions.

			Severity rubric:
			- LOW: localized impact, workaround exists, or no clear customer-facing degradation.
			- MEDIUM: partial degradation, limited blast radius, or unclear but non-urgent impact.
			- HIGH: major feature or service degradation with clear production impact.
			- CRITICAL: widespread outage, data loss risk, security issue, or complete loss of a critical path.

			Output quality rules:
			- summary: 2-4 sentences, plain language, state what is known vs uncertain.
			- suspectedComponent: one concrete component or subsystem; use "unknown" only if the evidence truly does not support a guess.
			- probableCauses: 2-5 short hypotheses ranked by likelihood; each must cite or paraphrase evidence from the context.
			- nextSteps: 3-7 ordered, actionable debugging or mitigation steps for an on-call engineer; start with the highest-value check.
			- confidence: 0.0-1.0 calibrated to evidence strength; use <= 0.55 when key facts are missing.
			- clarifyingQuestions: 0-5 specific questions that would materially change severity, causes, or next steps; omit generic filler questions.
			""";
	}

	public String buildAnalyzePrompt(AnalyzeIncidentRequest request) {
		return """
			Create a first-pass incident triage report for this incident.

			Incident title: %s
			Service name: %s
			Environment: %s
			Alert message: %s

			Logs / stack trace:
			%s

			Recent deploy notes:
			%s
			""".formatted(
			request.title().trim(),
			request.serviceName().trim(),
			request.environment().trim(),
			request.alertMessage().trim(),
			request.logsOrStackTrace().trim(),
			normalizeOptionalText(request.recentDeployNotes())
		);
	}

	public String buildRefinePrompt(RefineIncidentRequest request) {
		IncidentTriageReport previousReport = request.previousReport();
		String followUpAnswers = request.followUpAnswers().stream()
			.map(this::formatFollowUpAnswer)
			.collect(Collectors.joining("\n"));

		return """
			Refine the previous incident triage report using the new follow-up answers.
			Update severity, confidence, suspected component, causes, and next steps only when the new evidence warrants it.
			Do not repeat the previous report verbatim. Briefly reflect what changed in the summary when conclusions shift.
			Remove clarifying questions that the follow-up answers already resolved. Only add new clarifying questions if important evidence is still missing.
			Unanswered follow-up questions were skipped by the user; do not treat them as confirmed facts.

			Original incident context:
			Incident title: %s
			Service name: %s
			Environment: %s
			Alert message: %s

			Logs / stack trace:
			%s

			Recent deploy notes:
			%s

			Previous report:
			Summary: %s
			Severity: %s
			Suspected component: %s
			Probable causes: %s
			Next steps: %s
			Confidence: %.2f
			Clarifying questions: %s

			Follow-up answers provided:
			%s
			""".formatted(
			request.originalIncident().title().trim(),
			request.originalIncident().serviceName().trim(),
			request.originalIncident().environment().trim(),
			request.originalIncident().alertMessage().trim(),
			request.originalIncident().logsOrStackTrace().trim(),
			normalizeOptionalText(request.originalIncident().recentDeployNotes()),
			previousReport.summary(),
			previousReport.severity(),
			previousReport.suspectedComponent(),
			String.join("; ", previousReport.probableCauses()),
			String.join("; ", previousReport.nextSteps()),
			previousReport.confidence(),
			String.join("; ", previousReport.clarifyingQuestions()),
			followUpAnswers
		);
	}

	private String formatFollowUpAnswer(FollowUpAnswer answer) {
		return "Question: %s%nAnswer: %s".formatted(answer.question().trim(), answer.answer().trim());
	}

	private String normalizeOptionalText(String value) {
		if (value == null || value.isBlank()) {
			return "Not provided";
		}
		return value.trim();
	}
}
