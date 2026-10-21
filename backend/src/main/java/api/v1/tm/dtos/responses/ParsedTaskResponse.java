package api.v1.tm.dtos.responses;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Structured fields extracted from a natural-language task string.
 * Intended for UI preview / auto-fill before the caller submits a normal {@code TaskRequest}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ParsedTaskResponse {

    /** Cleaned title with priority / date / tag tokens removed. */
    private String taskTitle;

    /** Optional description hint (defaults to the original raw text when useful). */
    private String taskDescription;

    /** Normalized priority: low | medium | high | critical. Null when not detected. */
    private String priority;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate dueDate;

    /** Hashtag-style tags without the leading {@code #}. Empty when none found. */
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    /** Original input for round-trip / debugging. */
    private String rawText;

    /** Which signals were detected — useful for preview pills. */
    @Builder.Default
    private List<String> matchedSignals = new ArrayList<>();
}
