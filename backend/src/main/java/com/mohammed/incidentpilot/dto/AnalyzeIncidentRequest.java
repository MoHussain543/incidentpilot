package com.mohammed.incidentpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnalyzeIncidentRequest(
	@NotBlank(message = "Title is required")
	@Size(max = 120, message = "Title must be 120 characters or fewer")
	String title,
	@NotBlank(message = "Service name is required")
	@Size(max = 120, message = "Service name must be 120 characters or fewer")
	String serviceName,
	@NotBlank(message = "Environment is required")
	@Size(max = 60, message = "Environment must be 60 characters or fewer")
	String environment,
	@NotBlank(message = "Alert message is required")
	@Size(max = 800, message = "Alert message must be 800 characters or fewer")
	String alertMessage,
	@NotBlank(message = "Logs or stack trace are required")
	@Size(max = 20_000, message = "Logs or stack trace must be 20,000 characters or fewer")
	String logsOrStackTrace,
	@Size(max = 5_000, message = "Recent deploy notes must be 5,000 characters or fewer")
	String recentDeployNotes
) {
}
