package com.mohammed.incidentpilot.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

	private final CorsProperties corsProperties;

	public CorsConfig(CorsProperties corsProperties) {
		this.corsProperties = corsProperties;
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(parseAllowedOrigins());
		configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

	private List<String> parseAllowedOrigins() {
		return Arrays.stream(corsProperties.getAllowedOrigins().split(","))
			.map(String::trim)
			.filter(origin -> !origin.isBlank())
			.toList();
	}
}
