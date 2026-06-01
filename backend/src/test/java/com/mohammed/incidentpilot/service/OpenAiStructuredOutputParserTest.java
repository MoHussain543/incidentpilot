package com.mohammed.incidentpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mohammed.incidentpilot.domain.IncidentSeverity;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;

class OpenAiStructuredOutputParserTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void parsesStructuredIncidentReportFromResponseOutput() {
		String responseBody = """
			{
			  "output": [
			    {
			      "type": "message",
			      "role": "assistant",
			      "content": [
			        {
			          "type": "output_text",
			          "text": "{\\"summary\\":\\"Checkout traffic is failing after a deployment because the payment adapter cannot resolve the database host.\\",\\"severity\\":\\"HIGH\\",\\"suspectedComponent\\":\\"payment-adapter\\",\\"probableCauses\\":[\\"A bad database host value was deployed\\",\\"The payment service is reading a stale secret\\"],\\"nextSteps\\":[\\"Compare the current payment database host with the last known good release\\",\\"Check whether the payment service picked up the latest secret or config map\\"],\\"confidence\\":0.84,\\"clarifyingQuestions\\":[\\"Did this begin immediately after the latest deployment?\\"]}"
			        }
			      ]
			    }
			  ]
			}
			""";

		IncidentTriageReport report = OpenAiStructuredOutputParser.parseIncidentReport(responseBody, objectMapper);

		assertThat(report.summary()).contains("Checkout traffic is failing");
		assertThat(report.severity()).isEqualTo(IncidentSeverity.HIGH);
		assertThat(report.probableCauses()).hasSize(2);
		assertThat(report.clarifyingQuestions()).containsExactly("Did this begin immediately after the latest deployment?");
	}
}
