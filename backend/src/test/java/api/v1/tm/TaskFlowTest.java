package api.v1.tm;

import api.v1.tm.support.TestTokens;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * End-to-end integration tests exercising the real HTTP stack against the
 * local {@code taskmanagement_test} database with locally-minted JWTs.
 *
 * <p>No cloud / external services are contacted. Each test provisions its own
 * users (unique emails) so runs are isolated and repeatable.
 */
@QuarkusTest
class TaskFlowTest {

    private static final String BASE = "/tm/api/v1";

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Create an employee (invite row) as the given supervisor; returns its app_users id. */
    private long createEmployee(String supervisorToken, String email) {
        return given()
                .header("Authorization", "Bearer " + supervisorToken)
                .contentType("application/json")
                .body(Map.of("firstName", "Test", "lastName", "User",
                        "email", email, "role", "employee"))
                .when().post(BASE + "/users/create")
                .then().statusCode(201)
                .extract().<Number>path("data.id").longValue();
    }

    private long createTask(String supervisorToken, long employeeId, Map<String, Object> overrides) {
        var body = new java.util.HashMap<String, Object>();
        body.put("taskTitle", "Integration task");
        body.put("taskDescription", "Description long enough to pass validation");
        body.put("assignedTo", employeeId);
        body.put("priority", "medium");
        body.put("dueDate", LocalDate.now().plusDays(5).toString());
        body.putAll(overrides);

        return given()
                .header("Authorization", "Bearer " + supervisorToken)
                .contentType("application/json")
                .body(body)
                .when().post(BASE + "/tasks")
                .then().statusCode(201)
                .body("data.status", is("assigned"))
                .extract().<Number>path("data.taskId").longValue();
    }

    // ── users ──────────────────────────────────────────────────────────────────

    @Test
    void supervisorCreatesEmployeeAndItAppearsInList() {
        String supervisor = TestTokens.supervisor();
        String email = "emp-" + System.nanoTime() + "@test.local";
        long id = createEmployee(supervisor, email);

        given().header("Authorization", "Bearer " + supervisor)
                .when().get(BASE + "/users")
                .then().statusCode(200)
                .body("data.id", hasItem((int) id));
    }

    @Test
    void employeeCannotListUsers() {
        given().header("Authorization", "Bearer " + TestTokens.employee())
                .when().get(BASE + "/users")
                .then().statusCode(403)
                .body("errorCode", is("FORBIDDEN"));
    }

    @Test
    void duplicateEmailIsRejected() {
        String supervisor = TestTokens.supervisor();
        String email = "dup-" + System.nanoTime() + "@test.local";
        createEmployee(supervisor, email);

        given()
                .header("Authorization", "Bearer " + supervisor)
                .contentType("application/json")
                .body(Map.of("firstName", "Dup", "lastName", "Licate",
                        "email", email, "role", "employee"))
                .when().post(BASE + "/users/create")
                .then().statusCode(400)
                .body("errorMessage", containsString("already exists"));
    }

    // ── task lifecycle ───────────────────────────────────────────────────────

    @Test
    void fullHappyPathLifecycle() {
        String supervisor = TestTokens.supervisor();
        String email = "life-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);

        long taskId = createTask(supervisor, employeeId, Map.of());

        // employee: assigned → in_progress
        int v1 = given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 0))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(200).body("data.status", is("in_progress"))
                .extract().path("data.version");

        // employee (lead): in_progress → resolved
        int v2 = given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "resolved", "version", v1))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(200).body("data.status", is("resolved"))
                .extract().path("data.version");

        // supervisor: resolved → done
        given().header("Authorization", "Bearer " + supervisor)
                .contentType("application/json").body(Map.of("newStatus", "done", "version", v2))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(200).body("data.status", is("done"));
    }

    @Test
    void staleVersionCausesConflict() {
        String supervisor = TestTokens.supervisor();
        String email = "occ-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);
        long taskId = createTask(supervisor, employeeId, Map.of());

        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 999))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(409)
                .body("errorCode", is("CONFLICT"));
    }

    @Test
    void invalidTransitionForEmployeeIsRejected() {
        String supervisor = TestTokens.supervisor();
        String email = "bad-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);
        long taskId = createTask(supervisor, employeeId, Map.of());

        // assigned → done is not a legal employee transition
        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "done", "version", 0))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(400)
                .body("errorMessage", containsString("Invalid transition"));
    }

    @Test
    void employeeCannotCreateTasks() {
        given().header("Authorization", "Bearer " + TestTokens.employee())
                .contentType("application/json")
                .body(Map.of("taskTitle", "Nope",
                        "taskDescription", "Employee should not create tasks",
                        "assignedTo", 1))
                .when().post(BASE + "/tasks")
                .then().statusCode(403);
    }

    @Test
    void taskValidationRejectsShortTitle() {
        String supervisor = TestTokens.supervisor();
        given().header("Authorization", "Bearer " + supervisor)
                .contentType("application/json")
                .body(Map.of("taskTitle", "ab",
                        "taskDescription", "This description is definitely long enough",
                        "assignedTo", 1))
                .when().post(BASE + "/tasks")
                .then().statusCode(400)
                .body("errorCode", is("VALIDATION_ERROR"));
    }

    // ── rejection ────────────────────────────────────────────────────────────

    @Test
    void supervisorRejectsResolvedTaskBackToInProgress() {
        String supervisor = TestTokens.supervisor();
        String email = "rej-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);
        long taskId = createTask(supervisor, employeeId, Map.of());

        int v1 = given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 0))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(200).extract().path("data.version");

        int v2 = given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "resolved", "version", v1))
                .when().put(BASE + "/tasks/" + taskId + "/status")
                .then().statusCode(200).extract().path("data.version");

        given().header("Authorization", "Bearer " + supervisor)
                .contentType("application/json").body(Map.of("reason", "Needs more tests"))
                .when().post(BASE + "/tasks/" + taskId + "/reject")
                .then().statusCode(200)
                .body("data.status", is("in_progress"));
    }

    // ── dependencies ─────────────────────────────────────────────────────────

    @Test
    void blockedTaskCannotStartUntilDependencyResolved() {
        String supervisor = TestTokens.supervisor();
        String email = "dep-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);

        long blocker = createTask(supervisor, employeeId, Map.of("taskTitle", "Blocker task"));
        long dependent = createTask(supervisor, employeeId,
                Map.of("taskTitle", "Dependent task", "dependsOnTaskIds", List.of(blocker)));

        // Employee tries to start the blocked task → 400 (dependency unsatisfied)
        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 0))
                .when().put(BASE + "/tasks/" + dependent + "/status")
                .then().statusCode(400)
                .body("errorMessage", containsString("blocked by unfinished dependencies"));

        // Drive blocker to resolved (employee is lead on it too)
        int bv1 = given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 0))
                .when().put(BASE + "/tasks/" + blocker + "/status")
                .then().statusCode(200).extract().path("data.version");
        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "resolved", "version", bv1))
                .when().put(BASE + "/tasks/" + blocker + "/status")
                .then().statusCode(200);

        // Now the dependent can start
        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("newStatus", "in_progress", "version", 0))
                .when().put(BASE + "/tasks/" + dependent + "/status")
                .then().statusCode(200).body("data.status", is("in_progress"));
    }

    @Test
    void selfDependencyIsRejected() {
        String supervisor = TestTokens.supervisor();
        String email = "self-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        long taskId = createTask(supervisor, employeeId, Map.of());

        given().header("Authorization", "Bearer " + supervisor)
                .contentType("application/json").body(Map.of("dependsOnTaskId", taskId))
                .when().post(BASE + "/tasks/" + taskId + "/dependencies")
                .then().statusCode(400)
                .body("errorMessage", containsString("cannot depend on itself"));
    }

    // ── comments & notifications ─────────────────────────────────────────────

    @Test
    void commentingNotifiesCollaborators() {
        String supervisor = TestTokens.supervisor();
        String email = "com-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);
        long taskId = createTask(supervisor, employeeId, Map.of());

        given().header("Authorization", "Bearer " + employee)
                .contentType("application/json").body(Map.of("body", "Adding a progress update comment"))
                .when().post(BASE + "/tasks/" + taskId + "/comments")
                .then().statusCode(201)
                .body("data.body", is("Adding a progress update comment"));

        given().header("Authorization", "Bearer " + employee)
                .when().get(BASE + "/tasks/" + taskId + "/comments")
                .then().statusCode(200)
                .body("data", hasSize(greaterThanOrEqualTo(1)));
    }

    @Test
    void assigneeReceivesTaskCreatedNotification() {
        String supervisor = TestTokens.supervisor();
        String email = "notif-" + System.nanoTime() + "@test.local";
        long employeeId = createEmployee(supervisor, email);
        String employee = TestTokens.employeeWithEmail(email);
        createTask(supervisor, employeeId, Map.of());

        given().header("Authorization", "Bearer " + employee)
                .when().get(BASE + "/notifications/unread-count")
                .then().statusCode(200)
                .body("data.count", greaterThanOrEqualTo(1));

        given().header("Authorization", "Bearer " + employee)
                .when().get(BASE + "/notifications")
                .then().statusCode(200)
                .body("data.content.type", hasItem("TASK_CREATED"));
    }

    // ── natural-language parse endpoint ──────────────────────────────────────

    @Test
    void parseEndpointExtractsFields() {
        String supervisor = TestTokens.supervisor();
        given().header("Authorization", "Bearer " + supervisor)
                .contentType("application/json")
                .body(Map.of("text", "Write launch report #marketing critical by tomorrow"))
                .when().post(BASE + "/tasks/parse")
                .then().statusCode(200)
                .body("data.priority", is("critical"))
                .body("data.dueDate", notNullValue())
                .body("data.tags", hasItem("marketing"));
    }

    // ── auth guard ─────────────────────────────────────────────────────────────

    @Test
    void requestWithoutTokenIsUnauthorized() {
        given().when().get(BASE + "/tasks").then().statusCode(401);
    }
}
