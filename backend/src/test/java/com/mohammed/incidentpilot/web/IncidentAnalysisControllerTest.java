package com.mohammed.incidentpilot.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.mohammed.incidentpilot.domain.IncidentSeverity;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.exception.OpenAiServiceException;
import com.mohammed.incidentpilot.service.IncidentAnalysisService;

class IncidentAnalysisControllerTest {

	private final IncidentAnalysisService incidentAnalysisService = mock(IncidentAnalysisService.class);
	private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new IncidentAnalysisController(incidentAnalysisService))
		.setControllerAdvice(new ApiExceptionHandler())
		.build();

	@Test
	void analyzeReturnsStructuredTriageReport() throws Exception {
		IncidentTriageReport report = new IncidentTriageReport(
			"Payments are failing after the latest deployment because the adapter cannot reach the database.",
			IncidentSeverity.HIGH,
			"payment-adapter",
			List.of("A new database host value is invalid"),
			List.of("Compare the deployed DB host with the last successful release"),
			0.86,
			List.of("Did the issue begin immediately after the deployment?")
		);
		when(incidentAnalysisService.analyze(any())).thenReturn(report);

		mockMvc.perform(post("/api/v1/incidents/analyze")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "Checkout failures",
					  "serviceName": "payments",
					  "environment": "production",
					  "alertMessage": "HTTP 500 spike",
					  "logsOrStackTrace": "java.net.UnknownHostException: db.internal",
					  "recentDeployNotes": "Deployed build 204"
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.severity").value("HIGH"))
			.andExpect(jsonPath("$.suspectedComponent").value("payment-adapter"))
			.andExpect(jsonPath("$.clarifyingQuestions[0]").value("Did the issue begin immediately after the deployment?"));
	}

	@Test
	void analyzeReturnsValidationErrorsWhenRequiredFieldsAreMissing() throws Exception {
		mockMvc.perform(post("/api/v1/incidents/analyze")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "",
					  "serviceName": "",
					  "environment": "",
					  "alertMessage": "",
					  "logsOrStackTrace": "",
					  "recentDeployNotes": ""
					}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value("Please correct the highlighted fields."))
			.andExpect(jsonPath("$.fieldErrors.title").exists())
			.andExpect(jsonPath("$.fieldErrors.logsOrStackTrace").exists());
	}

	@Test
	void analyzeReturnsGatewayErrorWhenOpenAiFails() throws Exception {
		when(incidentAnalysisService.analyze(any())).thenThrow(new OpenAiServiceException("OpenAI request failed."));

		mockMvc.perform(post("/api/v1/incidents/analyze")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "title": "Checkout failures",
					  "serviceName": "payments",
					  "environment": "production",
					  "alertMessage": "HTTP 500 spike",
					  "logsOrStackTrace": "java.net.UnknownHostException: db.internal",
					  "recentDeployNotes": "Deployed build 204"
					}
					"""))
			.andExpect(status().isBadGateway())
			.andExpect(jsonPath("$.message").value("OpenAI request failed."));
	}
}
