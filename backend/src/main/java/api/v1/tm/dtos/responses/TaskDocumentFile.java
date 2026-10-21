package api.v1.tm.dtos.responses;

import java.nio.file.Path;

/**
 * Internal download payload (not serialized to JSON).
 */
public record TaskDocumentFile(
        Path path,
        String originalName,
        String contentType,
        long sizeBytes
) {}
