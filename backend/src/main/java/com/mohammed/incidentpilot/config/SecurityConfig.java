package com.mohammed.incidentpilot.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.spec.SecretKeySpec;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(AppSecurityProperties.class)
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		AppSecurityProperties securityProperties,
		JsonAuthenticationEntryPoint authenticationEntryPoint,
		JwtDecoder jwtDecoder
	) throws Exception {
		http.csrf(csrf -> csrf.disable());
		http.cors(Customizer.withDefaults());
		http.exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(authenticationEntryPoint));
		http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

		if (securityProperties.isAuthEnabled()) {
			http.authorizeHttpRequests(auth -> auth
				.requestMatchers("/api/v1/incidents/**").authenticated()
				.anyRequest().permitAll());
			http.oauth2ResourceServer(oauth2 -> oauth2
				.jwt(jwt -> jwt.decoder(jwtDecoder))
				.authenticationEntryPoint(authenticationEntryPoint));
		}
		else {
			http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
		}

		return http.build();
	}

	@Bean
	JwtDecoder jwtDecoder(AppSecurityProperties securityProperties) {
		if (!securityProperties.isAuthEnabled()) {
			return token -> {
				throw new JwtException("JWT authentication is not configured.");
			};
		}

		OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(
			securityProperties.resolveJwtIssuer()
		);

		List<JwtDecoder> decoders = new ArrayList<>();

		NimbusJwtDecoder jwkDecoder = NimbusJwtDecoder.withJwkSetUri(securityProperties.resolveJwkSetUri())
			.jwsAlgorithm(SignatureAlgorithm.RS256)
			.jwsAlgorithm(SignatureAlgorithm.ES256)
			.build();
		jwkDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator));
		decoders.add(jwkDecoder);

		if (securityProperties.hasJwtSecret()) {
			NimbusJwtDecoder hs256Decoder = NimbusJwtDecoder.withSecretKey(
				new SecretKeySpec(
					securityProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8),
					"HmacSHA256"
				)
			).macAlgorithm(MacAlgorithm.HS256).build();
			hs256Decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator));
			decoders.add(hs256Decoder);
		}

		return decoders.size() == 1 ? decoders.getFirst() : new ChainedJwtDecoder(decoders);
	}
}
