package api.v1.tm.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Pure unit tests for the task status constraint validator. */
class TaskStatusValidatorTest {

    private final TaskStatusValidator validator = new TaskStatusValidator();

    @Test
    void acceptsAllKnownStatuses() {
        for (String s : new String[]{"created", "assigned", "in_progress",
                "pending_approval", "resolved", "done"}) {
            assertTrue(validator.isValid(s, null), s + " should be valid");
        }
    }

    @Test
    void normalisesCaseAndWhitespace() {
        assertTrue(validator.isValid("  IN_PROGRESS  ", null));
        assertTrue(validator.isValid("Done", null));
    }

    @Test
    void rejectsNullBlankAndUnknown() {
        assertFalse(validator.isValid(null, null));
        assertFalse(validator.isValid("   ", null));
        assertFalse(validator.isValid("archived", null));
    }
}
