package api.v1.tm.support;

import io.smallrye.jwt.build.Jwt;

import java.util.UUID;

/**
 * Mints real RS256 JWTs locally for integration tests.
 *
 * <p>Tokens are signed with {@code src/test/resources/test-private-key.pem}
 * (configured via {@code smallrye.jwt.sign.key.location} in the test profile)
 * and verified by the app against the paired {@code test-public-key.pem}.
 * Nothing here touches an external identity provider or network.
 */
public final class TestTokens {

    /** Must match {@code mp.jwt.verify.issuer} in the test profile. */
    public static final String ISSUER = "http://localhost:8089/offline";

    private TestTokens() {
    }

    /** Supervisor token with a fresh unique subject + email. */
    public static String supervisor() {
        return token("supervisor", "supervisor@" + unique() + ".test");
    }

    /** Admin token with a fresh unique subject + email. */
    public static String admin() {
        return token("admin", "admin@" + unique() + ".test");
    }

    /** Employee token with a fresh unique subject + email. */
    public static String employee() {
        return token("employee", "employee@" + unique() + ".test");
    }

    /** Employee token pinned to a specific email (used to log in as a created invite). */
    public static String employeeWithEmail(String email) {
        return token("employee", email);
    }

    private static String token(String role, String email) {
        return Jwt.issuer(ISSUER)
                .subject("sub-" + UUID.randomUUID())
                .claim("email", email)
                .claim("role", role)
                .groups(role)
                .sign();
    }

    private static String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
