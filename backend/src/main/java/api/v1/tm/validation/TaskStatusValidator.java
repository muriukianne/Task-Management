package api.v1.tm.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

public class TaskStatusValidator implements ConstraintValidator<ValidTaskStatus, String> {

    private static final Set<String> VALID = Set.of(
            "created", "assigned", "in_progress", "pending_approval", "resolved", "done");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        if (value == null || value.isBlank()) return false;
        return VALID.contains(value.trim().toLowerCase());
    }
}
