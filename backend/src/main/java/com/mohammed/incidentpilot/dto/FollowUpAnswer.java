package com.mohammed.incidentpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FollowUpAnswer(
	@NotBlank(message = "Question is required")
	@Size(max = 300, message = "Question must be 300 characters or fewer")
	String question,
	@NotBlank(message = "Answer is required")
	@Size(max = 2_000, message = "Answer must be 2,000 characters or fewer")
	String answer
) {
}
