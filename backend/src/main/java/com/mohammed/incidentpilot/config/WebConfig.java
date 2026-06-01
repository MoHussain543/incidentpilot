package com.mohammed.incidentpilot.config;

import java.util.Arrays;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final CorsProperties corsProperties;

	public WebConfig(CorsProperties corsProperties) {
		this.corsProperties = corsProperties;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
			.allowedOrigins(parseAllowedOrigins())
			.allowedMethods("GET", "POST", "OPTIONS")
			.allowedHeaders("*");
	}

	private String[] parseAllowedOrigins() {
		return Arrays.stream(corsProperties.getAllowedOrigins().split(","))
			.map(String::trim)
			.filter(origin -> !origin.isBlank())
			.toArray(String[]::new);
	}
}
