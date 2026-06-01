package com.mohammed.incidentpilot.dto;

import java.util.List;
import java.util.Objects;

import com.mohammed.incidentpilot.domain.IncidentSeverity;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record IncidentTriageReport(
	@NotBlank(message = "Summary is required")
	@Size(max = 2_000, message = "Summary must be 2,000 characters or fewer")
	String summary,
	@NotNull(message = "Severity is required")
	IncidentSeverity severity,
	@NotBlank(message = "Suspected component is required")
	@Size(max = 200, message = "Suspected component must be 200 characters or fewer")
	String suspectedComponent,
	@NotNull(message = "Probable causes are required")
	@Size(min = 1, max = 5, message = "Provide between 1 and 5 probable causes")
	List<@NotBlank @Size(max = 300) String> probableCauses,
	@NotNull(message = "Next steps are required")
	@Size(min = 1, max = 7, message = "Provide between 1 and 7 next steps")
	List<@NotBlank @Size(max = 300) String> nextSteps,
	@DecimalMin(value = "0.0", message = "Confidence must be at least 0")
	@DecimalMax(value = "1.0", message = "Confidence must be at most 1")
	double confidence,
	@NotNull(message = "Clarifying questions are required")
	@Size(max = 5, message = "Clarifying questions must be 5 or fewer")
	List<@NotBlank @Size(max = 300) String> clarifyingQuestions
) {
	public IncidentTriageReport {
		probableCauses = List.copyOf(Objects.requireNonNullElse(probableCauses, List.of()));
		nextSteps = List.copyOf(Objects.requireNonNullElse(nextSteps, List.of()));
		clarifyingQuestions = List.copyOf(Objects.requireNonNullElse(clarifyingQuestions, List.of()));
	}
}
