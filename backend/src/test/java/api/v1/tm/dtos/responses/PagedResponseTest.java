package api.v1.tm.dtos.responses;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Pure unit tests for the pagination envelope helper. */
class PagedResponseTest {

    @Test
    void computesTotalPagesAndNavigationForFirstPage() {
        PagedResponse<String> page = PagedResponse.of(List.of("a", "b"), 0, 2, 5);
        assertEquals(3, page.getTotalPages());
        assertTrue(page.isHasNext());
        assertFalse(page.isHasPrevious());
    }

    @Test
    void lastPageHasNoNext() {
        PagedResponse<String> page = PagedResponse.of(List.of("e"), 2, 2, 5);
        assertEquals(3, page.getTotalPages());
        assertFalse(page.isHasNext());
        assertTrue(page.isHasPrevious());
    }

    @Test
    void emptyResultHasZeroPages() {
        PagedResponse<String> page = PagedResponse.of(List.of(), 0, 20, 0);
        assertEquals(0, page.getTotalPages());
        assertFalse(page.isHasNext());
    }
}
