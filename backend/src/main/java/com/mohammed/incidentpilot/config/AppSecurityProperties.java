package com.mohammed.incidentpilot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

	private boolean requireAuth = true;
	private String supabaseUrl = "";
	private String jwtIssuer = "";
	private String jwkSetUri = "";
	private String jwtSecret = "";

	public boolean isRequireAuth() {
		return requireAuth;
	}

	public void setRequireAuth(boolean requireAuth) {
		this.requireAuth = requireAuth;
	}

	public String getSupabaseUrl() {
		return supabaseUrl;
	}

	public void setSupabaseUrl(String supabaseUrl) {
		this.supabaseUrl = supabaseUrl;
	}

	public String getJwtIssuer() {
		return jwtIssuer;
	}

	public void setJwtIssuer(String jwtIssuer) {
		this.jwtIssuer = jwtIssuer;
	}

	public String getJwkSetUri() {
		return jwkSetUri;
	}

	public void setJwkSetUri(String jwkSetUri) {
		this.jwkSetUri = jwkSetUri;
	}

	public String getJwtSecret() {
		return jwtSecret;
	}

	public void setJwtSecret(String jwtSecret) {
		this.jwtSecret = jwtSecret;
	}

	public boolean hasJwtSecret() {
		return StringUtils.hasText(jwtSecret);
	}

	public String resolveJwtIssuer() {
		if (StringUtils.hasText(jwtIssuer)) {
			return trimTrailingSlash(jwtIssuer);
		}

		if (!StringUtils.hasText(supabaseUrl)) {
			return "";
		}

		String normalizedSupabaseUrl = trimTrailingSlash(supabaseUrl);
		if (normalizedSupabaseUrl.endsWith("/auth/v1")) {
			return normalizedSupabaseUrl;
		}

		return normalizedSupabaseUrl + "/auth/v1";
	}

	public String resolveJwkSetUri() {
		if (StringUtils.hasText(jwkSetUri)) {
			return trimTrailingSlash(jwkSetUri);
		}

		String issuer = resolveJwtIssuer();
		if (!StringUtils.hasText(issuer)) {
			return "";
		}

		return issuer + "/.well-known/jwks.json";
	}

	public boolean isAuthEnabled() {
		return requireAuth
			&& StringUtils.hasText(resolveJwtIssuer())
			&& StringUtils.hasText(resolveJwkSetUri());
	}

	private String trimTrailingSlash(String value) {
		return value == null ? "" : value.trim().replaceAll("/+$", "");
	}
}
