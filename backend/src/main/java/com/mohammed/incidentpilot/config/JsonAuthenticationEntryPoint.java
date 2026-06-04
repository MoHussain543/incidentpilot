package com.mohammed.incidentpilot.config;

import java.io.IOException;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mohammed.incidentpilot.dto.ApiErrorResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private static final Logger log = LoggerFactory.getLogger(JsonAuthenticationEntryPoint.class);

	private final ObjectMapper objectMapper;

	public JsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void commence(
		HttpServletRequest request,
		HttpServletResponse response,
		AuthenticationException authException
	) throws IOException {
		log.warn(
			"Unauthorized {} {}: {}",
			request.getMethod(),
			request.getRequestURI(),
			authException.getMessage()
		);
		Throwable cause = authException.getCause();
		while (cause != null) {
			log.warn("  caused by: {}", cause.getMessage());
			cause = cause.getCause();
		}

		response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(
			response.getWriter(),
			new ApiErrorResponse("Authentication is required for incident analysis.", Map.of())
		);
	}
}
