# Team Setup

Invite and manage team members with role-based access.

---

## Roles

| Role | Access |
|---|---|
| `OWNER` | Full access. Can manage team, credentials, and all settings. |
| `ADMIN` | Admin access without team management or owner-only credential operations. |
| `STAFF` | Read and standard mutation access. No team or credential management. |

Only one OWNER can exist at a time. The last owner cannot be disabled or demoted.

---

## Inviting a team member

1. Go to **Settings → Team** in the admin.
2. Click **Invite member**.
3. Enter the email address and select a role.
4. Click **Send invite**.

The invitee receives a single-use invite link that expires after 24 hours.

They accept at `/join?token=<token>` and set their password on first login.

---

## Managing existing users

From **Settings → Team**:

- **Change role** — OWNER can change any team member's role (except demoting the last owner).
- **Disable** — Immediately revokes all sessions. The user cannot log in.
- **Reactivate** — Restores access.
- **Revoke invite** — Cancels a pending invite before it is accepted.
- **Resend invite** — Sends a new invite link (expires previous token).

---

## Password management

Users can change their own password at **Settings → My account**.

Owners can trigger a password reset for any user:

1. Go to **Settings → Team**.
2. Open the user's actions.
3. Click **Send password reset**.

The user receives a reset link valid for 24 hours. All sessions are revoked on acceptance.

---

## Session management

Users can revoke their other active sessions at **Settings → My account → Revoke other sessions**.

Owners can view and revoke sessions for any user via the Team panel.

---

## Recovery: locked out of owner account

Use the CLI recovery tool:

```bash
npm run doopify:reset-owner
```

Creates the first OWNER if none exists, or resets any existing OWNER password and revokes all sessions.

See [docs/ADMIN_USER_RECOVERY_GUIDE.md](../ADMIN_USER_RECOVERY_GUIDE.md) for full procedures.
