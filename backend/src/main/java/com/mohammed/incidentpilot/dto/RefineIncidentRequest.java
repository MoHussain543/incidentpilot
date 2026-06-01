package com.mohammed.incidentpilot.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record RefineIncidentRequest(
	@NotNull(message = "Original incident is required")
	@Valid
	AnalyzeIncidentRequest originalIncident,
	@NotNull(message = "Previous report is required")
	@Valid
	IncidentTriageReport previousReport,
	@NotEmpty(message = "At least one follow-up answer is required")
	List<@Valid FollowUpAnswer> followUpAnswers
) {
}
