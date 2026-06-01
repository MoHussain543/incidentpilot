package com.mohammed.incidentpilot.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.mohammed.incidentpilot.dto.ApiErrorResponse;
import com.mohammed.incidentpilot.exception.MissingConfigurationException;
import com.mohammed.incidentpilot.exception.OpenAiServiceException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		exception.getBindingResult().getFieldErrors().forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));

		return ResponseEntity.badRequest().body(new ApiErrorResponse("Please correct the highlighted fields.", fieldErrors));
	}

	@ExceptionHandler(MissingConfigurationException.class)
	public ResponseEntity<ApiErrorResponse> handleMissingConfiguration(MissingConfigurationException exception) {
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
			.body(new ApiErrorResponse(exception.getMessage(), Map.of()));
	}

	@ExceptionHandler(OpenAiServiceException.class)
	public ResponseEntity<ApiErrorResponse> handleOpenAi(OpenAiServiceException exception) {
		return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
			.body(new ApiErrorResponse(exception.getMessage(), Map.of()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(new ApiErrorResponse("An unexpected error occurred while processing the incident.", Map.of()));
	}
}
