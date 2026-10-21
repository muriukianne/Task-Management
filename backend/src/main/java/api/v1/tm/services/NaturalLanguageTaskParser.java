package api.v1.tm.services;

import api.v1.tm.dtos.responses.ParsedTaskResponse;

/**
 * Extracts structured task fields from free-text natural language input.
 * Deterministic rule-based parser (no external LLM) for MVP reliability.
 */
public interface NaturalLanguageTaskParser {

    /**
     * Parse raw text into title, optional priority, due date, and tags.
     *
     * @param text free-form input, e.g. {@code "Finish API docs by Friday #backend high-priority"}
     * @return structured preview fields; never {@code null}
     */
    ParsedTaskResponse parse(String text);
}
