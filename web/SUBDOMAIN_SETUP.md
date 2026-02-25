# Subdomain Configuration Guide
## Local Development Setup
### Windows Hosts File Configuration
**File Location**: `C:\Windows\System32\drivers\etc\hosts`
**Required Entries**:
```
127.0.0.1 localhost
127.0.0.1 sadmin.localhost
127.0.0.1 greenwood.localhost
127.0.0.1 oakridge.localhost
```
### How to Edit (Windows):
1. Open Notepad as Administrator
2. File → Open → Navigate to `C:\Windows\System32\drivers\etc\`
3. Change file type filter to "All Files"
4. Open `hosts` file
5. Add the entries above
6. Save and close
### Verification:
```bash
ping sadmin.localhost
# Should respond from 127.0.0.1
```
## Testing Subdomain Routing
After configuration, you can access:
- **Root Domain**: http://localhost:5173
- **Super Admin**: http://sadmin.localhost:5173
- **Tenant (Greenwood)**: http://greenwood.localhost:5173
- **Tenant (Oakridge)**: http://oakridge.localhost:5173
## Vite Configuration
The `vite.config.ts` has been updated with:
```typescript
server: {
  host: true,      // Allow network access
  port: 5173,
  strictPort: true // Fail if port in use
}
```
## Browser Cache
If subdomains don't work immediately:
1. Clear browser cache
2. Hard refresh (Ctrl + Shift + R)
3. Restart Vite dev server
