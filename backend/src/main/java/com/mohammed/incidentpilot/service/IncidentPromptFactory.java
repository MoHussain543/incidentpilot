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
			Base the answer only on the provided incident context.
			If the evidence is incomplete or ambiguous, say so in the summary, lower confidence, and ask clarifying questions.
			Keep probable causes and next steps concrete, short, and operationally useful.
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
			Update severity, confidence, suspected component, causes, and next steps if the new evidence warrants it.

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

			Follow-up answers:
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
