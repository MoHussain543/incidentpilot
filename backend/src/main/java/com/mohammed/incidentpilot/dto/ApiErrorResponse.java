package com.mohammed.incidentpilot.dto;

import java.util.Map;

public record ApiErrorResponse(
	String message,
	Map<String, String> fieldErrors
) {
}
