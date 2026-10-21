package api.v1.tm.services;

import api.v1.tm.dtos.responses.ParsedTaskResponse;
import jakarta.enterprise.context.ApplicationScoped;
import lombok.extern.slf4j.Slf4j;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Month;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rule-based natural-language task parser.
 * <p>
 * Extracts (in order): hashtag tags → priority keywords → relative/absolute due dates → cleaned title.
 * Compatible with existing TaskFlow values: priority {@code low|medium|high|critical}, due date {@link LocalDate}.
 */
@Slf4j
@ApplicationScoped
public class NaturalLanguageTaskParserImpl implements NaturalLanguageTaskParser {

    private static final Pattern HASHTAG = Pattern.compile("#([\\w-]+)");

    /** Priority phrases ordered longest-first so "high-priority" wins over "high". */
    private static final List<PriorityRule> PRIORITY_RULES = List.of(
            new PriorityRule("critical", Pattern.compile("\\b(critical|p0|priority\\s*[:=]?\\s*critical)\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("critical", Pattern.compile("\\burgent\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("high", Pattern.compile("\\b(high[-\\s]?priority|priority\\s*[:=]?\\s*high|p1)\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("high", Pattern.compile("\\b(important|asap)\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("low", Pattern.compile("\\b(low[-\\s]?priority|priority\\s*[:=]?\\s*low|p3)\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("medium", Pattern.compile("\\b(medium[-\\s]?priority|priority\\s*[:=]?\\s*medium|normal[-\\s]?priority|p2)\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("high", Pattern.compile("\\bhigh\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("low", Pattern.compile("\\blow\\b", Pattern.CASE_INSENSITIVE)),
            new PriorityRule("medium", Pattern.compile("\\bmedium\\b", Pattern.CASE_INSENSITIVE))
    );

    private static final Pattern ISO_DATE = Pattern.compile("\\b(\\d{4}-\\d{2}-\\d{2})\\b");
    private static final Pattern SLASH_DATE = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{4})\\b");
    private static final Pattern MONTH_DAY = Pattern.compile(
            "\\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
                    + "sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern DAY_MONTH = Pattern.compile(
            "\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
                    + "aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern RELATIVE_DATE = Pattern.compile(
            "\\b(?:due\\s+)?(?:by\\s+|on\\s+|before\\s+)?"
                    + "(today|tomorrow|tonight|"
                    + "next\\s+week|"
                    + "in\\s+(\\d+)\\s+days?|"
                    + "(?:this\\s+|next\\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday))"
                    + "\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern CONNECTOR_CLEANUP = Pattern.compile(
            "\\s*(?:due\\s+)?(?:by|on|before)\\s*$|\\s{2,}|^[\\s,.:;-]+|[\\s,.:;-]+$",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, Month> MONTHS = Map.ofEntries(
            Map.entry("jan", Month.JANUARY), Map.entry("january", Month.JANUARY),
            Map.entry("feb", Month.FEBRUARY), Map.entry("february", Month.FEBRUARY),
            Map.entry("mar", Month.MARCH), Map.entry("march", Month.MARCH),
            Map.entry("apr", Month.APRIL), Map.entry("april", Month.APRIL),
            Map.entry("may", Month.MAY),
            Map.entry("jun", Month.JUNE), Map.entry("june", Month.JUNE),
            Map.entry("jul", Month.JULY), Map.entry("july", Month.JULY),
            Map.entry("aug", Month.AUGUST), Map.entry("august", Month.AUGUST),
            Map.entry("sep", Month.SEPTEMBER), Map.entry("sept", Month.SEPTEMBER), Map.entry("september", Month.SEPTEMBER),
            Map.entry("oct", Month.OCTOBER), Map.entry("october", Month.OCTOBER),
            Map.entry("nov", Month.NOVEMBER), Map.entry("november", Month.NOVEMBER),
            Map.entry("dec", Month.DECEMBER), Map.entry("december", Month.DECEMBER)
    );

    private static final Map<String, DayOfWeek> WEEKDAYS = Map.of(
            "monday", DayOfWeek.MONDAY,
            "tuesday", DayOfWeek.TUESDAY,
            "wednesday", DayOfWeek.WEDNESDAY,
            "thursday", DayOfWeek.THURSDAY,
            "friday", DayOfWeek.FRIDAY,
            "saturday", DayOfWeek.SATURDAY,
            "sunday", DayOfWeek.SUNDAY
    );

    @Override
    public ParsedTaskResponse parse(String text) {
        if (text == null || text.isBlank()) {
            return ParsedTaskResponse.builder()
                    .taskTitle("")
                    .rawText(text)
                    .tags(List.of())
                    .matchedSignals(List.of())
                    .build();
        }

        String working = text.trim();
        List<String> signals = new ArrayList<>();
        LocalDate today = LocalDate.now();

        // 1. Tags (#backend, #api-docs)
        Set<String> tags = new LinkedHashSet<>();
        Matcher tagMatcher = HASHTAG.matcher(working);
        while (tagMatcher.find()) {
            tags.add(tagMatcher.group(1).toLowerCase(Locale.ROOT));
        }
        if (!tags.isEmpty()) {
            signals.add("tags");
            working = HASHTAG.matcher(working).replaceAll(" ");
        }

        // 2. Priority
        String priority = null;
        for (PriorityRule rule : PRIORITY_RULES) {
            Matcher m = rule.pattern().matcher(working);
            if (m.find()) {
                priority = rule.priority();
                signals.add("priority:" + priority);
                working = m.replaceFirst(" ");
                break;
            }
        }

        // 3. Due date (absolute first, then relative)
        LocalDate dueDate = null;
        Optional<DateMatch> absolute = extractAbsoluteDate(working, today);
        if (absolute.isPresent()) {
            dueDate = absolute.get().date();
            working = absolute.get().remainder();
            signals.add("dueDate:absolute");
        } else {
            Optional<DateMatch> relative = extractRelativeDate(working, today);
            if (relative.isPresent()) {
                dueDate = relative.get().date();
                working = relative.get().remainder();
                signals.add("dueDate:relative");
            }
        }

        String title = cleanupTitle(working);
        if (title.isBlank()) {
            title = text.trim();
        }

        // Keep a usable description seed for TaskRequest (min length 10 on create).
        String description = text.trim().length() >= 10
                ? text.trim()
                : title + " (created from natural language)";

        ParsedTaskResponse result = ParsedTaskResponse.builder()
                .taskTitle(truncate(title, 200))
                .taskDescription(truncate(description, 5000))
                .priority(priority)
                .dueDate(dueDate)
                .tags(List.copyOf(tags))
                .rawText(text.trim())
                .matchedSignals(List.copyOf(signals))
                .build();

        log.debug("Parsed NL task: title='{}' priority={} dueDate={} tags={}",
                result.getTaskTitle(), result.getPriority(), result.getDueDate(), result.getTags());
        return result;
    }

    private Optional<DateMatch> extractAbsoluteDate(String text, LocalDate today) {
        Matcher iso = ISO_DATE.matcher(text);
        if (iso.find()) {
            try {
                LocalDate date = LocalDate.parse(iso.group(1), DateTimeFormatter.ISO_LOCAL_DATE);
                return Optional.of(new DateMatch(date, iso.replaceFirst(" ")));
            } catch (DateTimeParseException ignored) {
                // fall through
            }
        }

        Matcher slash = SLASH_DATE.matcher(text);
        if (slash.find()) {
            try {
                int month = Integer.parseInt(slash.group(1));
                int day = Integer.parseInt(slash.group(2));
                int year = Integer.parseInt(slash.group(3));
                LocalDate date = LocalDate.of(year, month, day);
                return Optional.of(new DateMatch(date, slash.replaceFirst(" ")));
            } catch (Exception ignored) {
                // invalid calendar date
            }
        }

        Matcher monthDay = MONTH_DAY.matcher(text);
        if (monthDay.find()) {
            Month month = MONTHS.get(monthDay.group(1).toLowerCase(Locale.ROOT));
            int day = Integer.parseInt(monthDay.group(2));
            if (month != null) {
                LocalDate date = resolveMonthDay(today, month, day);
                return Optional.of(new DateMatch(date, monthDay.replaceFirst(" ")));
            }
        }

        Matcher dayMonth = DAY_MONTH.matcher(text);
        if (dayMonth.find()) {
            int day = Integer.parseInt(dayMonth.group(1));
            Month month = MONTHS.get(dayMonth.group(2).toLowerCase(Locale.ROOT));
            if (month != null) {
                LocalDate date = resolveMonthDay(today, month, day);
                return Optional.of(new DateMatch(date, dayMonth.replaceFirst(" ")));
            }
        }

        return Optional.empty();
    }

    private Optional<DateMatch> extractRelativeDate(String text, LocalDate today) {
        Matcher m = RELATIVE_DATE.matcher(text);
        if (!m.find()) {
            return Optional.empty();
        }

        String whole = m.group(1).toLowerCase(Locale.ROOT);
        LocalDate date;

        if (whole.equals("today") || whole.equals("tonight")) {
            date = today;
        } else if (whole.equals("tomorrow")) {
            date = today.plusDays(1);
        } else if (whole.equals("next week")) {
            date = today.plusWeeks(1);
        } else if (m.group(2) != null) {
            date = today.plusDays(Long.parseLong(m.group(2)));
        } else if (m.group(3) != null) {
            DayOfWeek target = WEEKDAYS.get(m.group(3).toLowerCase(Locale.ROOT));
            boolean next = whole.startsWith("next ");
            date = nextWeekday(today, target, next);
        } else {
            return Optional.empty();
        }

        return Optional.of(new DateMatch(date, m.replaceFirst(" ")));
    }

    private static LocalDate nextWeekday(LocalDate today, DayOfWeek target, boolean forceNext) {
        if (forceNext) {
            return today.with(TemporalAdjusters.next(target));
        }
        // "by Friday" / "this Friday" → upcoming occurrence (today if already that day)
        if (today.getDayOfWeek() == target) {
            return today;
        }
        return today.with(TemporalAdjusters.next(target));
    }

    private static LocalDate resolveMonthDay(LocalDate today, Month month, int day) {
        LocalDate candidate = LocalDate.of(today.getYear(), month, Math.min(day, month.length(today.isLeapYear())));
        if (candidate.isBefore(today)) {
            candidate = candidate.plusYears(1);
        }
        return candidate;
    }

    private static String cleanupTitle(String working) {
        String cleaned = CONNECTOR_CLEANUP.matcher(working.trim()).replaceAll(" ").trim();
        cleaned = cleaned.replaceAll("\\s{2,}", " ").trim();
        // Drop leftover leading connectors like "by" / "due"
        cleaned = cleaned.replaceAll("^(?:due\\s+)?(?:by|on|before)\\s+", "");
        return cleaned.trim();
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }

    private record PriorityRule(String priority, Pattern pattern) {}

    private record DateMatch(LocalDate date, String remainder) {}
}
