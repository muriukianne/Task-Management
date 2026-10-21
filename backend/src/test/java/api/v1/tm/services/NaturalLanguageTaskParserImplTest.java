package api.v1.tm.services;

import api.v1.tm.dtos.responses.ParsedTaskResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit tests for the rule-based natural-language parser —
 * no Quarkus runtime, no database, no network.
 */
class NaturalLanguageTaskParserImplTest {

    private final NaturalLanguageTaskParserImpl parser = new NaturalLanguageTaskParserImpl();

    @Test
    void blankInputReturnsEmptyTitle() {
        ParsedTaskResponse result = parser.parse("   ");
        assertEquals("", result.getTaskTitle());
        assertTrue(result.getTags().isEmpty());
        assertNull(result.getPriority());
        assertNull(result.getDueDate());
    }

    @Test
    void extractsHashtagTagsAndStripsThemFromTitle() {
        ParsedTaskResponse result = parser.parse("Refine the API docs #backend #Api-Docs");
        assertTrue(result.getTags().contains("backend"));
        assertTrue(result.getTags().contains("api-docs"));
        assertFalse(result.getTaskTitle().contains("#"));
        assertTrue(result.getMatchedSignals().contains("tags"));
    }

    @Test
    void detectsPriorityKeywords() {
        assertEquals("critical", parser.parse("This is critical, fix now").getPriority());
        assertEquals("high", parser.parse("Fix the outage ASAP").getPriority());
        assertEquals("high", parser.parse("high-priority: migrate DB").getPriority());
        assertEquals("low", parser.parse("low priority cleanup").getPriority());
        assertEquals("medium", parser.parse("p2 tidy up imports").getPriority());
    }

    @Test
    void parsesIsoAndSlashDates() {
        assertEquals(LocalDate.of(2027, 3, 14),
                parser.parse("Ship release notes 2027-03-14").getDueDate());
        assertEquals(LocalDate.of(2027, 12, 25),
                parser.parse("Wrap up Q4 12/25/2027").getDueDate());
    }

    @Test
    void parsesTomorrowRelativeToToday() {
        ParsedTaskResponse result = parser.parse("Review pull requests tomorrow");
        assertEquals(LocalDate.now().plusDays(1), result.getDueDate());
        assertTrue(result.getMatchedSignals().contains("dueDate:relative"));
    }

    @Test
    void parsesInNDays() {
        assertEquals(LocalDate.now().plusDays(5),
                parser.parse("Prep demo in 5 days").getDueDate());
    }

    @Test
    void monthDayResolvesToUpcomingOccurrence() {
        // A definitely-past fixed date must roll forward to next year
        ParsedTaskResponse result = parser.parse("Freeze config on Jan 1st");
        LocalDate due = result.getDueDate();
        assertNotNull(due);
        assertEquals(1, due.getMonthValue());
        assertEquals(1, due.getDayOfMonth());
        assertFalse(due.isBefore(LocalDate.now()));
    }

    @Test
    void descriptionSeedIsLongEnoughForCreation() {
        // TaskRequest requires >= 10 chars of description
        ParsedTaskResponse result = parser.parse("fix bug");
        assertTrue(result.getTaskDescription().length() >= 10);
    }

    @Test
    void titleFallsBackToRawTextWhenEverythingIsStripped() {
        ParsedTaskResponse result = parser.parse("tomorrow");
        assertFalse(result.getTaskTitle().isBlank());
    }
}
