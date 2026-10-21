package api.v1.tm.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Pure unit tests for the priority constraint validator (field is optional). */
class PriorityValidatorTest {

    private final PriorityValidator validator = new PriorityValidator();

    @Test
    void acceptsKnownPriorities() {
        for (String p : new String[]{"low", "medium", "high", "critical"}) {
            assertTrue(validator.isValid(p, null), p + " should be valid");
        }
    }

    @Test
    void treatsNullAndBlankAsDefault() {
        assertTrue(validator.isValid(null, null));
        assertTrue(validator.isValid("   ", null));
    }

    @Test
    void rejectsUnknownPriorityAndNormalisesCase() {
        assertFalse(validator.isValid("urgent", null));
        assertTrue(validator.isValid(" HIGH ", null));
    }
}
