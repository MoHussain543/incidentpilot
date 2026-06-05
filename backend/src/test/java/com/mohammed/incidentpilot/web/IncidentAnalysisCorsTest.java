package com.mohammed.incidentpilot.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
	"app.cors.allowed-origins=https://incidentpilot.vercel.app,http://localhost:5173",
	"app.security.require-auth=true",
	"app.security.supabase-url=https://example.supabase.co",
	"openai.api-key=test-key"
})
class IncidentAnalysisCorsTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void analyzeEndpointAllowsConfiguredFrontendOriginPreflight() throws Exception {
		mockMvc.perform(options("/api/v1/incidents/analyze")
				.header("Origin", "https://incidentpilot.vercel.app")
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "authorization,content-type"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "https://incidentpilot.vercel.app"));
	}

	@Test
	void analyzeEndpointRejectsUnconfiguredFrontendOriginPreflight() throws Exception {
		mockMvc.perform(options("/api/v1/incidents/analyze")
				.header("Origin", "https://evil.example")
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "authorization,content-type"))
			.andExpect(status().isForbidden());
	}
}
