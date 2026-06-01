package com.mohammed.incidentpilot.service;

import org.springframework.stereotype.Service;

import com.mohammed.incidentpilot.dto.AnalyzeIncidentRequest;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.dto.RefineIncidentRequest;

@Service
public class IncidentAnalysisService {

	private final IncidentPromptFactory promptFactory;
	private final OpenAiIncidentClient openAiIncidentClient;

	public IncidentAnalysisService(IncidentPromptFactory promptFactory, OpenAiIncidentClient openAiIncidentClient) {
		this.promptFactory = promptFactory;
		this.openAiIncidentClient = openAiIncidentClient;
	}

	public IncidentTriageReport analyze(AnalyzeIncidentRequest request) {
		return openAiIncidentClient.generateReport(
			promptFactory.buildSystemInstructions(),
			promptFactory.buildAnalyzePrompt(request)
		);
	}

	public IncidentTriageReport refine(RefineIncidentRequest request) {
		return openAiIncidentClient.generateReport(
			promptFactory.buildSystemInstructions(),
			promptFactory.buildRefinePrompt(request)
		);
	}
}
