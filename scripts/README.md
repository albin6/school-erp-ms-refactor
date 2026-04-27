# Scripts

## Smoke test

After starting the backend stack with Docker Compose, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

The smoke test verifies:

- Super-admin login
- Tenant provisioning to `ACTIVE`
- Tenant-admin login using the development temporary password
- Tenant `/me` and tenant user listing
- Refresh-token rotation and reuse protection
- Identity and Tenant outbox drain

The script reads local Docker logs to fetch development temporary passwords and checks Postgres containers for outbox status, so Docker access is required.
