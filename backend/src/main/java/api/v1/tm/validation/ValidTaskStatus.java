package api.v1.tm.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = TaskStatusValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTaskStatus {
    String message() default "Invalid status. Allowed: created, assigned, in_progress, pending_approval, resolved, done";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
