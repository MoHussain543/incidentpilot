package com.mohammed.incidentpilot.exception;

public class OpenAiServiceException extends RuntimeException {

	public OpenAiServiceException(String message) {
		super(message);
	}

	public OpenAiServiceException(String message, Throwable cause) {
		super(message, cause);
	}
}
