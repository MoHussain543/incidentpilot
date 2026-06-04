package com.mohammed.incidentpilot.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mohammed.incidentpilot.domain.IncidentSeverity;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.service.IncidentAnalysisService;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
	"app.security.require-auth=true",
	"app.security.supabase-url=https://example.supabase.co",
	"openai.api-key=test-key"
})
class IncidentAnalysisSecurityTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private IncidentAnalysisService incidentAnalysisService;

	@MockitoBean
	private JwtDecoder jwtDecoder;

	@Test
	void analyzeRequiresAuthenticationWhenSecurityIsEnabled() throws Exception {
		mockMvc.perform(post("/api/v1/incidents/analyze")
				.contentType(MediaType.APPLICATION_JSON)
				.content(validAnalyzePayload()))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.message").value("Authentication is required for incident analysis."));
	}

	@Test
	void analyzeRejectsMalformedBearerTokens() throws Exception {
		when(jwtDecoder.decode(eq("not-a-real-token"))).thenThrow(new JwtException("Invalid token"));

		assertThrows(AuthenticationServiceException.class, () ->
			mockMvc.perform(post("/api/v1/incidents/analyze")
					.header("Authorization", "Bearer not-a-real-token")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validAnalyzePayload()))
		);
	}

	@Test
	void analyzeAcceptsValidBearerToken() throws Exception {
		when(incidentAnalysisService.analyze(any())).thenReturn(sampleReport());
		when(jwtDecoder.decode(eq("valid-token"))).thenReturn(validJwt());

		mockMvc.perform(post("/api/v1/incidents/analyze")
				.header("Authorization", "Bearer valid-token")
				.contentType(MediaType.APPLICATION_JSON)
				.content(validAnalyzePayload()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.severity").value("HIGH"));
	}

	private IncidentTriageReport sampleReport() {
		return new IncidentTriageReport(
			"Payments are failing after the latest deployment.",
			IncidentSeverity.HIGH,
			"payment-adapter",
			List.of("A new database host value is invalid"),
			List.of("Compare the deployed DB host with the last successful release"),
			0.86,
			List.of("Did the issue begin immediately after the deployment?")
		);
	}

	private String validAnalyzePayload() {
		return """
			{
			  "title": "Checkout failures",
			  "serviceName": "payments",
			  "environment": "production",
			  "alertMessage": "HTTP 500 spike",
			  "logsOrStackTrace": "java.net.UnknownHostException: db.internal",
			  "recentDeployNotes": "Deployed build 204"
			}
			""";
	}

	private Jwt validJwt() {
		Instant issuedAt = Instant.now();
		return new Jwt(
			"valid-token",
			issuedAt,
			issuedAt.plusSeconds(3600),
			Map.of("alg", "RS256", "typ", "JWT"),
			Map.of(
				"sub", "user-123",
				"aud", List.of("authenticated"),
				"role", "authenticated",
				"iss", "https://example.supabase.co/auth/v1"
			)
		);
	}
}
