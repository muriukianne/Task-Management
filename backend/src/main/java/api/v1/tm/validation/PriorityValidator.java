package api.v1.tm.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

public class PriorityValidator implements ConstraintValidator<ValidPriority, String> {

    private static final Set<String> VALID = Set.of("low", "medium", "high", "critical");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        // Field is optional — null/blank means "use default"
        if (value == null || value.isBlank()) return true;
        return VALID.contains(value.trim().toLowerCase());
    }
}
