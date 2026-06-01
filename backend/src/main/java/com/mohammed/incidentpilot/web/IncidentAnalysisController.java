package com.mohammed.incidentpilot.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mohammed.incidentpilot.dto.AnalyzeIncidentRequest;
import com.mohammed.incidentpilot.dto.IncidentTriageReport;
import com.mohammed.incidentpilot.dto.RefineIncidentRequest;
import com.mohammed.incidentpilot.service.IncidentAnalysisService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/incidents")
public class IncidentAnalysisController {

	private final IncidentAnalysisService incidentAnalysisService;

	public IncidentAnalysisController(IncidentAnalysisService incidentAnalysisService) {
		this.incidentAnalysisService = incidentAnalysisService;
	}

	@PostMapping("/analyze")
	public ResponseEntity<IncidentTriageReport> analyze(@Valid @RequestBody AnalyzeIncidentRequest request) {
		return ResponseEntity.ok(incidentAnalysisService.analyze(request));
	}

	@PostMapping("/refine")
	public ResponseEntity<IncidentTriageReport> refine(@Valid @RequestBody RefineIncidentRequest request) {
		return ResponseEntity.ok(incidentAnalysisService.refine(request));
	}
}
