package com.mohammed.incidentpilot.service;

import java.io.IOException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.exception.OpenAiServiceException;

final class OpenAiStructuredOutputParser {

	private OpenAiStructuredOutputParser() {
	}

	static IncidentTriageReport parseIncidentReport(String responseBody, ObjectMapper objectMapper) {
		try {
			JsonNode root = objectMapper.readTree(responseBody);
			String outputText = extractOutputText(root);
			return objectMapper.readValue(outputText, IncidentTriageReport.class);
		}
		catch (IOException exception) {
			throw new OpenAiServiceException("OpenAI returned a response that could not be parsed.", exception);
		}
	}

	private static String extractOutputText(JsonNode root) {
		String directOutputText = root.path("output_text").asText(null);
		if (directOutputText != null && !directOutputText.isBlank()) {
			return directOutputText;
		}

		for (JsonNode outputItem : root.path("output")) {
			for (JsonNode contentItem : outputItem.path("content")) {
				String type = contentItem.path("type").asText();
				if ("output_text".equals(type)) {
					return contentItem.path("text").asText();
				}
				if ("refusal".equals(type)) {
					throw new OpenAiServiceException("OpenAI refused to analyze this incident context.");
				}
			}
		}

		throw new OpenAiServiceException("OpenAI did not return structured output text.");
	}
}
