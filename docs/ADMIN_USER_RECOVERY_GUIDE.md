# Admin User Recovery Guide

> Recovery path when admin/owner login access is lost.
>
> Last updated: April 29, 2026

## When To Use

- OWNER account password lost
- OWNER account deactivated
- bootstrap owner missing

## Preconditions

- Database access is available.
- You can run commands in project root.

## Recovery Method (CLI-safe)

Set temporary credentials in shell:

```bash
$env:DOOPIFY_ADMIN_EMAIL="owner@example.com"
$env:DOOPIFY_ADMIN_PASSWORD="temporary-strong-password"
```

Run recovery script:

```bash
@'
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = String(process.env.DOOPIFY_ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.DOOPIFY_ADMIN_PASSWORD || "");

if (!email || !password) {
  throw new Error("DOOPIFY_ADMIN_EMAIL and DOOPIFY_ADMIN_PASSWORD are required.");
}

const passwordHash = await bcrypt.hash(password, 12);
const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash, role: "OWNER", isActive: true },
  });
  console.log(`Updated OWNER user: ${email}`);
} else {
  await prisma.user.create({
    data: { email, passwordHash, role: "OWNER", isActive: true },
  });
  console.log(`Created OWNER user: ${email}`);
}

await prisma.$disconnect();
'@ | node --input-type=module
```

## Post-Recovery Steps

1. Log in with temporary password.
2. Rotate to a permanent strong password immediately.
3. Review session security and revoke unknown sessions.
4. Record incident and resolution in internal ops notes.

## Safety Notes

- Do not commit recovery credentials.
- Treat temporary credentials as compromised after use.
- Prefer one-time password reset policy if available in future phases.
