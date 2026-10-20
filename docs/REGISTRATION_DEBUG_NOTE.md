# Engineering Debug Note: Registration Entity Identity and Versioning

**Project:** AI-Powered Conference Management Platform  
**Context:** Registration API integration test  
**Date:** 19 October 2026  
**Status:** Registration creation test passing; broader regression testing pending

## 1. Summary

The registration creation integration test initially failed because the `Registration` domain entity attempted to assign values to getter-only properties inherited from the shared `Entity` base class.

Two initialization issues were identified:

- Identity assignment failed because the entity attempted to assign to `this.id` after calling the base constructor.
- Version assignment failed because the entity attempted to assign to `this.version` even though the base class exposes version through a getter.

After correcting entity initialization, the registration API integration test passed. The endpoint returned HTTP `201 Created` and a registration response containing the expected registration details.

This establishes that the tested registration-creation path works. It does not establish that all registration lifecycle operations or concurrency scenarios have been verified.

## 2. Symptoms and root causes

### Issue A — Identity assignment

**Error:**

`TypeError: Cannot set property id of [object Object] which has only a getter`

**Root cause:**

The shared `Entity` base class owns entity identity and exposes it through a getter:

```js
get id() {
    return this._id;
}
```

The `Registration` constructor called `super(id)` and then attempted to assign `this.id = id`.

Because the inherited `id` property has no setter, the second assignment failed. The subclass was duplicating initialization already handled by the base class.

**Resolution:**

Remove the redundant assignment:

```js
this.id = id;
```

Let the base constructor initialize and validate the identity.

### Issue B — Version assignment

**Error:**

`TypeError: Cannot set property version of [object Object> which has only a getter`

**Root cause:**

The base class owns version initialization and exposes it through a getter:

```js
get version() {
    return this._version;
}
```

Assigning directly to `this.version` in the `Registration` constructor conflicts with that getter-only interface.

**Resolution:**

Pass the version to the base constructor:

```js
super(id, Number(version));
```

Remove the direct subclass assignment:

```js
this.version = Number(version);
```

The base constructor should remain responsible for validating that the supplied version is a non-negative integer.

**Version-management requirement:**

The repository must not assign directly to `registration.version`.

For optimistic concurrency, use the aggregate's explicit version-management method, such as `registration.incrementVersion()`, if that method is supported by the implementation. The in-memory version must remain consistent with the database version, and it should advance only when the corresponding database update succeeds.

The exact ordering depends on the repository's transaction and unit-of-work design and should be verified against the implementation.

## 3. Verification

**Integration test:** `test/api/registration.test.js`

**Command:**

```powershell
$previousPaystackSecretKey = $env:PAYSTACK_SECRET_KEY

try {
    $env:PAYSTACK_SECRET_KEY = "sk_test_dummy_key"

    .\node_modules\.bin\jest.cmd test/api/registration.test.js --runInBand --coverage=false --forceExit
}
finally {
    if ($null -eq $previousPaystackSecretKey) {
        Remove-Item Env:PAYSTACK_SECRET_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:PAYSTACK_SECRET_KEY = $previousPaystackSecretKey
    }
}
```

**Observed result:**

- Test suites: 1 passed, 1 total
- Tests: 1 passed, 1 total
- Endpoint: `POST /api/v1/registrations`
- HTTP status: `201 Created`
- Response included a registration ID, attendee ID, event ID, ticket type, status, and timestamps.

**Test-environment note:**

The test required a temporary dummy `PAYSTACK_SECRET_KEY` because application startup validates that the environment variable exists. The dummy value is for startup/testing only; it is not a valid payment credential and must not be used for actual transactions.

The PowerShell wrapper saves and restores the previous environment value so the test does not permanently replace the shell's existing configuration.

## 4. Engineering lessons

1. **Respect base-class ownership.** Identity and version initialization belong to the `Entity` base class. Subclasses should not duplicate that initialization.

2. **Treat getter-only properties as read interfaces.** Mutations should go through the owning class's constructor or explicit methods rather than direct property assignment.

3. **Keep optimistic concurrency consistent.** The database version and the in-memory aggregate version must advance consistently. A failed database update must not leave the aggregate representing an uncommitted version.

4. **Test through the application boundary.** An integration test exposed a domain-entity construction defect that controller-only tests might not have detected.

5. **Separate configuration failures from application defects.** Missing startup configuration can prevent a test from reaching the endpoint. A temporary test value can isolate API behavior, provided the distinction from real credentials remains explicit.

6. **Verify event ownership.** If both `Registration` and `AggregateRoot` maintain pending domain-event queues, event recording and consumption may become inconsistent. The implementation should use one clearly defined mechanism.

## 5. Follow-up actions

- [ ] Run the complete registration-related regression suite as additional tests are added.
- [ ] Add tests for optimistic-concurrency conflicts and successful version increments.
- [ ] Verify that confirmation, cancellation, and check-in preserve registration invariants.
- [ ] Review repository update logic to ensure database and in-memory versions remain synchronized.
- [ ] Review registration domain-event recording and transactional-outbox delivery.
- [ ] Check whether `Registration` and `AggregateRoot` maintain separate pending-event queues; consolidate or document ownership if necessary.
- [ ] Test failure and retry behavior for registration persistence and outbox publishing.
- [ ] Investigate the Jest `--forceExit` warning if it persists after tests complete.
- [ ] Run the full Jest suite to identify regressions outside the registration module.
- [ ] Check Git status and history to confirm which changes are present and whether they have been committed.

## 6. Scope and confidence

The passing integration test verifies the tested registration-creation path under the test environment.

The following remain unverified until dedicated tests or code review establish them:

- Optimistic-concurrency correctness under simultaneous updates.
- Confirmation, cancellation, and check-in lifecycle behavior.
- Exactly-once business effects when events are retried; message delivery itself may be at least once.
- Atomic persistence of registration state and outbox records.
- Reliable event delivery after application or broker failures.
- Complete test-suite health and clean application shutdown.

This note records the observed test result and the identified fixes. It does not certify production readiness.

## 7. Key takeaway

A domain entity should have one clear owner for identity, versioning, and domain events. Subclasses should express domain behavior while respecting the base-class contracts.

Integration tests provide evidence that these contracts hold across the request lifecycle, but broader lifecycle, concurrency, persistence, and event-delivery tests are still required before treating the registration module as fully verified.