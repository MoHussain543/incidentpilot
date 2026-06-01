package com.mohammed.incidentpilot.service;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mohammed.incidentpilot.config.OpenAiProperties;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.exception.MissingConfigurationException;
import com.mohammed.incidentpilot.exception.OpenAiServiceException;

@Component
public class OpenAiIncidentClient {

	private final RestClient restClient;
	private final ObjectMapper objectMapper;
	private final OpenAiProperties openAiProperties;

	public OpenAiIncidentClient(ObjectMapper objectMapper, OpenAiProperties openAiProperties) {
		this.restClient = RestClient.builder()
			.baseUrl(openAiProperties.getBaseUrl())
			.build();
		this.objectMapper = objectMapper;
		this.openAiProperties = openAiProperties;
	}

	public IncidentTriageReport generateReport(String systemInstructions, String userPrompt) {
		if (!StringUtils.hasText(openAiProperties.getApiKey())) {
			throw new MissingConfigurationException("The server is missing OPENAI_API_KEY.");
		}

		String requestBody = serializeRequest(systemInstructions, userPrompt);
		try {
			String responseBody = restClient.post()
				.uri("/responses")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + openAiProperties.getApiKey())
				.contentType(MediaType.APPLICATION_JSON)
				.body(requestBody)
				.retrieve()
				.body(String.class);

			if (!StringUtils.hasText(responseBody)) {
				throw new OpenAiServiceException("OpenAI returned an empty response.");
			}

			return OpenAiStructuredOutputParser.parseIncidentReport(responseBody, objectMapper);
		}
		catch (RestClientResponseException exception) {
			String responseSnippet = exception.getResponseBodyAsString();
			throw new OpenAiServiceException(
				"OpenAI request failed with status %s. %s"
					.formatted(exception.getStatusCode(), abbreviate(responseSnippet)),
				exception
			);
		}
		catch (OpenAiServiceException | MissingConfigurationException exception) {
			throw exception;
		}
		catch (Exception exception) {
			throw new OpenAiServiceException("OpenAI request failed unexpectedly.", exception);
		}
	}

	private String serializeRequest(String systemInstructions, String userPrompt) {
		Map<String, Object> request = Map.of(
			"model", openAiProperties.getModel(),
			"store", false,
			"instructions", systemInstructions,
			"input", List.of(
				Map.of(
					"role", "user",
					"content", List.of(
						Map.of(
							"type", "input_text",
							"text", userPrompt
						)
					)
				)
			),
			"text", Map.of(
				"format", Map.of(
					"type", "json_schema",
					"name", "incident_triage_report",
					"strict", true,
					"schema", Map.of(
						"type", "object",
						"additionalProperties", false,
						"properties", Map.of(
							"summary", Map.of("type", "string"),
							"severity", Map.of("type", "string", "enum", List.of("LOW", "MEDIUM", "HIGH", "CRITICAL")),
							"suspectedComponent", Map.of("type", "string"),
							"probableCauses", Map.of(
								"type", "array",
								"items", Map.of("type", "string")
							),
							"nextSteps", Map.of(
								"type", "array",
								"items", Map.of("type", "string")
							),
							"confidence", Map.of("type", "number"),
							"clarifyingQuestions", Map.of(
								"type", "array",
								"items", Map.of("type", "string")
							)
						),
						"required", List.of(
							"summary",
							"severity",
							"suspectedComponent",
							"probableCauses",
							"nextSteps",
							"confidence",
							"clarifyingQuestions"
						)
					)
				)
			)
		);

		try {
			return objectMapper.writeValueAsString(request);
		}
		catch (JsonProcessingException exception) {
			throw new OpenAiServiceException("Failed to serialize the OpenAI request.", exception);
		}
	}

	private String abbreviate(String responseSnippet) {
		if (!StringUtils.hasText(responseSnippet)) {
			return "No response body was returned.";
		}

		if (responseSnippet.length() <= 400) {
			return responseSnippet;
		}

		return responseSnippet.substring(0, 400) + "...";
	}
}
