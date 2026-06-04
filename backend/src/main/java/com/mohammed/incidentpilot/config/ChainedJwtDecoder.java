package com.mohammed.incidentpilot.config;

import java.util.List;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/**
 * Tries multiple decoders so Supabase tokens can be verified whether they use
 * asymmetric JWKS keys (RS256/ES256) or legacy HS256 shared-secret signing.
 */
final class ChainedJwtDecoder implements JwtDecoder {

	private final List<JwtDecoder> decoders;

	ChainedJwtDecoder(List<JwtDecoder> decoders) {
		if (decoders.isEmpty()) {
			throw new IllegalArgumentException("At least one JWT decoder is required.");
		}
		this.decoders = List.copyOf(decoders);
	}

	@Override
	public Jwt decode(String token) throws JwtException {
		JwtException lastFailure = null;

		for (JwtDecoder decoder : decoders) {
			try {
				return decoder.decode(token);
			}
			catch (JwtException exception) {
				lastFailure = exception;
			}
		}

		throw lastFailure != null ? lastFailure : new JwtException("JWT validation failed.");
	}
}
