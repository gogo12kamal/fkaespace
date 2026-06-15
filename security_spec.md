# Security Specification & Threat Model for SpaceBook

This document outlines the zero-trust security invariants, potential compromise payloads, and rule verification criteria for the SpaceBook firestore instance.

## 1. Core Data Invariants

- **Authentication Check:** No unauthenticated user can read, list, create, edit, or delete any record in the database. Every write requires `request.auth.token.email_verified == true`.
- **Identity Integrity:** A user can only create a booking where `userId == request.auth.uid` and `userEmail == request.auth.token.email`. They cannot forge reservations for other people.
- **Role Lockout:** No client can write or update documents inside the `/admins/` collection. Users cannot modify their own custom profile `role` field to "admin" or self-escalate privileges.
- **Asset Catalog Integrity:** The `/rooms/` collection is read-only for standard authenticated users. Only verified administrators can insert, update, or remove physical metadata documents.
- **Workflow State Protection:** Standard users can create booking requests with status set strictly to `pending`. Standard users can NEVER write booking requests directly as `approved` or `rejected`.
- **Terminal State Lock:** Once a booking has reached a terminal status (`approved` or `rejected`), it cannot be updated to any other status by standard users.
- **Selective Field Updates:** When a standard user cancels a booking, they can only transition status to `rejected` (canceled) and update the `updatedAt` field. They cannot modify the room, date, or owner fields of an existing booking. This is enforced via MapDiff `affectedKeys().hasOnly(['status', 'updatedAt'])`.
- **Admin Privilege:** Admins (identified by checking `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) have blanket write authority to modify any booking's `status` or details for administrative approval.
- **Temporal Enforcement:** `createdAt` and `updatedAt` fields must be bound to `request.time`.

---

## 2. The "Dirty Dozen" Threat Payloads (Attack Vector Matrix)

### Payload 1: The Identity Forgery (Spoofing another user's UID)
An authenticated user `UID_A` attempts to insert a booking for user `UID_B` to consume database space or frame them.
```json
// Path: /bookings/maliciousbook1
// Auth: UID_A (email: userA@test.com)
{
  "id": "maliciousbook1",
  "roomId": "room-1",
  "roomName": "Classic Boardroom",
  "userId": "UID_B", // SPOOFING
  "userEmail": "userB@test.com",
  "userName": "Victim User",
  "date": "2026-06-20",
  "startTime": "10:00",
  "endTime": "11:00",
  "purpose": "Hacking session",
  "status": "pending",
  "createdAt": "2026-06-15T00:00:00Z",
  "updatedAt": "2026-06-15T00:00:00Z"
}
```
*Expected Result:* `PERMISSION_DENIED` - rule must enforce `incoming().userId == request.auth.uid`.

### Payload 2: Self-Approve Booking (Skipping authorization)
A normal user attempts to directly create an pre-verified booking bypassing staff oversight.
```json
// Path: /bookings/selfapprove1
// Auth: UID_A (email: userA@test.com)
{
  "id": "selfapprove1",
  "roomId": "room-1",
  "roomName": "Classic Boardroom",
  "userId": "UID_A",
  "userEmail": "userA@test.com",
  "userName": "Naughty User",
  "date": "2026-06-20",
  "startTime": "10:00",
  "endTime": "11:00",
  "purpose": "Sneaking in",
  "status": "approved", // SECURITY BYPASS
  "createdAt": "2026-06-15T00:00:00Z",
  "updatedAt": "2026-06-15T00:00:00Z"
}
```
*Expected Result:* `PERMISSION_DENIED` - default creation state must restrict `status` to `pending`.

### Payload 3: Privilege Escalation (Modifying self-profile role)
A normal user attempts to save their user profile document setting `role: "admin"`.
```json
// Path: /users/UID_A
// Auth: UID_A (email: userA@test.com)
{
  "uid": "UID_A",
  "email": "userA@test.com",
  "role": "admin", // ATTEMPTED PRIVILEGE ESCALATION
  "createdAt": "2026-06-15T00:00:00Z"
}
```
*Expected Result:* `PERMISSION_DENIED` - users cannot set `role` to anything other than `user` or role field must be strict block.

### Payload 4: Fake Admin Database Enlistment
A normal user tries to insert their own UID directly into the global `/admins/` directory.
```json
// Path: /admins/UID_A
// Auth: UID_A (email: userA@test.com)
{
  "uid": "UID_A",
  "email": "userA@test.com"
}
```
*Expected Result:* `PERMISSION_DENIED` - client-driven writes to the `/admins/` collection are strictly disabled.

### Payload 5: Denying Wallet (Resource Poisoning via ID Injection)
An attacker tries to write code injecting a massive length character ID as document key.
```json
// Path: /bookings/very_long_custom_compromised_id_string_that_exceeds_one_thousand_bytes_of_garbage...
// Auth: UID_A
{ ...booking_body... }
```
*Expected Result:* `PERMISSION_DENIED` - rule must enforce `isValidId(bookingId)` which restricts ID length to `<= 128` and enforces matching format regex check.

### Payload 6: Room Catalog Modification (Unauthorized room insert)
A normal user attempts to create a new bookable room, or modify room details.
```json
// Path: /rooms/unauthroom
// Auth: UID_A (email: userA@test.com)
{
  "id": "unauthroom",
  "name": "Anarchist Vault",
  "capacity": 500,
  "layoutType": "Lecture",
  "description": "Uncontrolled room description"
}
```
*Expected Result:* `PERMISSION_DENIED` - `/rooms/` write operations are blocked unless verified `isAdmin()`.

### Payload 7: Client-Side Timestamp Bypassing (Old time manipulation)
A user tries to slip in a backlog of historic time stamps.
```json
// Path: /bookings/badtime1
// Auth: UID_A
{
  "id": "badtime1",
  "roomId": "room-1",
  "roomName": "Classic Boardroom",
  "userId": "UID_A",
  "userEmail": "userA@test.com",
  "date": "2026-06-20",
  "startTime": "10:00",
  "endTime": "11:00",
  "purpose": "Hacking",
  "status": "pending",
  "createdAt": "2020-01-01T00:00:00Z", // SPOOFED OLD TIMESTAMP
  "updatedAt": "2020-01-01T00:00:00Z"
}
```
*Expected Result:* `PERMISSION_DENIED` - rules must enforce that `createdAt` and `updatedAt` exactly match `request.time`.

### Payload 8: Blanket DB Harvesting (Scraping and listing all bookings)
An authenticated user UID_A attempts a blanket retrieval of all bookings without selecting their own UID.
```javascript
// Query check
getDocs(collection(db, "bookings")); // BLANKET LIST QUERY
```
*Expected Result:* `PERMISSION_DENIED` - rules enforce that listing bookings under `allow list` requires checking `resource.data.userId == request.auth.uid || isAdmin()`.

### Payload 9: Hijacking Another User's Booking Status (Ghost Field Attack)
An authenticated user UID_A attempts to change the date, time, or room of traveler user UID_B's booking under the guise of general booking editing.
```json
// Path: /bookings/booking_of_user_b
// Auth: UID_A
// Update fields:
{
  "roomId": "room-99", // HIJACKING/STEALING ROOM
  "date": "2026-06-30"
}
```
*Expected Result:* `PERMISSION_DENIED` - updates on bookings by non-admins are restricted strictly to cancellation (i.e. changing `status` to `rejected`/cancel and updating the `updatedAt` field).

### Payload 10: State Overwriting After Terminal Closure
A user attempts to revert a booking's status from "approved" back to "pending" to re-process it.
```json
// Path: /bookings/completedbook1 (status is already approved)
// Auth: UID_A
// Attempt to write: status = "pending"
```
*Expected Result:* `PERMISSION_DENIED` - once a booking is terminal, a non-admin user cannot change its details or revert its status.

### Payload 11: Null Email Spoofing Attack
An attacker authenticates with an unverified email account and attempts to write.
```json
// Auth: UID_A (email_verified: false)
```
*Expected Result:* `PERMISSION_DENIED` - rule must enforce `request.auth.token.email_verified == true`.

### Payload 12: Injection of Massive Payload Strings
An attacker attempts to write descriptive fields with 1MB texts causing storage blowouts.
```json
// Purpose: "A" x 1000000 characters
```
*Expected Result:* `PERMISSION_DENIED` - rules must enforce character limits on string properties (`size() <= 500` or similar).

---

## 3. Threat Verification Assertion Script

The following tests check the constraints and threat model against `DRAFT_firestore.rules`:

```ts
// firestore.rules.test.ts (Draft representation)
// Implements testing suite asserting all payloads above return PERMISSION_DENIED.
```
