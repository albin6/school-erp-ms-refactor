param(
    [string]$GatewayUrl = "http://localhost:8000",
    [string]$AdminEmail = "admin@school.com",
    [string]$AdminPassword = "Admin@123",
    [string]$ComposeProjectDir = (Resolve-Path "$PSScriptRoot\..").Path,
    [int]$AsyncWaitSeconds = 8
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Invoke-Json {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null
    )

    $params = @{
        Uri = $Uri
        Method = $Method
        Headers = $Headers
    }

    if ($Session) {
        $params.WebSession = $Session
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8)
        $params.ContentType = "application/json"
    }

    Invoke-RestMethod @params
}

function Get-DevTemporaryPassword {
    param(
        [string]$Email,
        [string]$ProjectDir
    )

    $logs = docker compose logs --since=5m identity-service 2>$null
    $escapedEmail = [regex]::Escape($Email)
    $match = $logs | Select-String -Pattern "Temporary password for $escapedEmail`: (?<password>\S+)" | Select-Object -Last 1

    if (-not $match) {
        throw "Could not find dev temporary password for $Email in identity-service logs."
    }

    $match.Matches[0].Groups["password"].Value
}

function Test-RefreshReuse {
    param([string]$GatewayUrl)

    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.UseCookies = $false
    $client = [System.Net.Http.HttpClient]::new($handler)

    try {
        $loginJson = (@{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json)
        $loginContent = [System.Net.Http.StringContent]::new($loginJson, [System.Text.Encoding]::UTF8, "application/json")
        $loginResponse = $client.PostAsync("$GatewayUrl/api/auth/login", $loginContent).Result
        Assert-True ([int]$loginResponse.StatusCode -eq 200) "refresh-reuse login should succeed"

        $oldCookieHeader = ($loginResponse.Headers.GetValues("Set-Cookie") | Select-Object -First 1)
        $oldRefreshToken = [regex]::Match($oldCookieHeader, "refreshToken=([^;]+)").Groups[1].Value
        Assert-True ([bool]$oldRefreshToken) "login should set refreshToken cookie"

        $refreshRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$GatewayUrl/api/auth/refresh")
        $refreshRequest.Headers.Add("Cookie", "refreshToken=$oldRefreshToken")
        $refreshResponse = $client.SendAsync($refreshRequest).Result
        Assert-True ([int]$refreshResponse.StatusCode -eq 200) "first refresh should succeed"

        $newCookieHeader = ($refreshResponse.Headers.GetValues("Set-Cookie") | Select-Object -First 1)
        $newRefreshToken = [regex]::Match($newCookieHeader, "refreshToken=([^;]+)").Groups[1].Value
        Assert-True ($oldRefreshToken -ne $newRefreshToken) "refresh should rotate cookie value"

        $reuseRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$GatewayUrl/api/auth/refresh")
        $reuseRequest.Headers.Add("Cookie", "refreshToken=$oldRefreshToken")
        $reuseResponse = $client.SendAsync($reuseRequest).Result
        Assert-True ([int]$reuseResponse.StatusCode -eq 401) "reusing old refresh token should be rejected"

        $familyRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$GatewayUrl/api/auth/refresh")
        $familyRequest.Headers.Add("Cookie", "refreshToken=$newRefreshToken")
        $familyResponse = $client.SendAsync($familyRequest).Result
        Assert-True ([int]$familyResponse.StatusCode -eq 401) "new refresh token should be rejected after family reuse"
    }
    finally {
        $client.Dispose()
    }
}

Push-Location $ComposeProjectDir
try {
    Write-Step "Checking gateway health"
    $health = Invoke-RestMethod -Uri "$GatewayUrl/health/live" -Method GET
    Assert-True ($health -eq "OK") "gateway health should be OK"

    Write-Step "Logging in as super admin"
    $adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $login = Invoke-Json -Uri "$GatewayUrl/api/auth/login" -Method POST -Body @{ email = $AdminEmail; password = $AdminPassword } -Session $adminSession
    Assert-True $login.success "super admin login should succeed"
    $adminToken = $login.data.accessToken
    Assert-True ([bool]$adminToken) "super admin access token should be present"

    Write-Step "Creating smoke tenant"
    $subdomain = "smoke" + (Get-Date -Format "HHmmss")
    $tenantAdminEmail = "admin-$subdomain@example.com"
    $tenant = Invoke-Json `
        -Uri "$GatewayUrl/api/tenants" `
        -Method POST `
        -Body @{ name = "Smoke School $subdomain"; subdomain = $subdomain; adminEmail = $tenantAdminEmail } `
        -Headers @{ Authorization = "Bearer $adminToken" } `
        -Session $adminSession

    Assert-True $tenant.success "tenant creation should succeed"
    $tenantId = $tenant.data.tenantId
    Assert-True ([bool]$tenantId) "tenant id should be present"

    Start-Sleep -Seconds $AsyncWaitSeconds

    $tenantDetails = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId" -Headers @{ Authorization = "Bearer $adminToken" } -Session $adminSession
    Assert-True ($tenantDetails.data.status -eq "ACTIVE") "tenant should become ACTIVE"
    Assert-True ($tenantDetails.data.is_active -eq $true) "tenant should be active"

    Write-Step "Logging in as generated tenant admin"
    $tenantAdminPassword = Get-DevTemporaryPassword -Email $tenantAdminEmail -ProjectDir $ComposeProjectDir
    $tenantSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $tenantLogin = Invoke-Json `
        -Uri "$GatewayUrl/api/auth/tenant/$subdomain/admin/login" `
        -Method POST `
        -Body @{ email = $tenantAdminEmail; password = $tenantAdminPassword } `
        -Session $tenantSession

    Assert-True $tenantLogin.success "tenant admin login should succeed"
    Assert-True ($tenantLogin.data.user.role -eq "ADMIN") "tenant admin role should be ADMIN"
    $tenantToken = $tenantLogin.data.accessToken

    Write-Step "Checking tenant admin protected routes"
    $tenantMe = Invoke-Json -Uri "$GatewayUrl/api/auth/tenant/$subdomain/me" -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True ($tenantMe.data.user.email -eq $tenantAdminEmail) "tenant /me should return generated admin"

    $tenantUsers = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/users" -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True ($tenantUsers.data.users.Count -ge 1) "tenant user listing should return at least the admin"

    Write-Step "Checking branch and tenant-user management routes"
    $branchSlug = "main-$subdomain"
    $branch = Invoke-Json `
        -Uri "$GatewayUrl/api/tenants/$tenantId/branches" `
        -Method POST `
        -Body @{ name = "Main Campus"; slug = $branchSlug; address = "123 Smoke St"; phone = "555-0100"; email = "main-$subdomain@example.com" } `
        -Headers @{ Authorization = "Bearer $tenantToken" } `
        -Session $tenantSession
    Assert-True $branch.success "branch creation should succeed"
    $branchId = $branch.data.id

    $updatedBranch = Invoke-Json `
        -Uri "$GatewayUrl/api/tenants/$tenantId/branches/$branchId" `
        -Method PATCH `
        -Body @{ phone = "555-0199" } `
        -Headers @{ Authorization = "Bearer $tenantToken" } `
        -Session $tenantSession
    Assert-True ($updatedBranch.data.phone -eq "555-0199") "branch update should persist phone"

    $slugBranch = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/branches/slug/$branchSlug" -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True ($slugBranch.data.id -eq $branchId) "branch slug lookup should return the branch"

    $blockedBranch = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/branches/$branchId/status" -Method PATCH -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True ($blockedBranch.data.status -eq "BLOCKED") "branch status toggle should block active branch"
    $activeBranch = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/branches/$branchId/status" -Method PATCH -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True ($activeBranch.data.status -eq "ACTIVE") "branch status toggle should reactivate blocked branch"

    $studentEmail = "student-$subdomain@example.com"
    $student = Invoke-Json `
        -Uri "$GatewayUrl/api/tenants/$tenantId/users" `
        -Method POST `
        -Body @{ name = "Smoke Student"; email = $studentEmail; role = "STUDENT"; branch_id = $branchId } `
        -Headers @{ Authorization = "Bearer $tenantToken" } `
        -Session $tenantSession
    Assert-True $student.success "tenant student creation should succeed"
    $studentUserId = $student.data.user_id

    $updatedStudent = Invoke-Json `
        -Uri "$GatewayUrl/api/tenants/$tenantId/users/$studentUserId" `
        -Method PATCH `
        -Body @{ role = "STAFF"; sub_role = "TEACHER"; branch_id = $branchId } `
        -Headers @{ Authorization = "Bearer $tenantToken" } `
        -Session $tenantSession
    Assert-True ($updatedStudent.data.role -eq "STAFF") "tenant user role update should persist"
    Assert-True ($updatedStudent.data.sub_role -eq "TEACHER") "tenant user sub-role update should persist"

    try {
        Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/branches/$branchId" -Method DELETE -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession | Out-Null
        throw "Expected branch delete with assigned user to fail"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Assert-True ($statusCode -eq 409) "branch delete with assigned users should return 409"
    }

    $deleteUser = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/users/$studentUserId" -Method DELETE -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True $deleteUser.success "tenant user delete should succeed"
    $deleteBranch = Invoke-Json -Uri "$GatewayUrl/api/tenants/$tenantId/branches/$branchId" -Method DELETE -Headers @{ Authorization = "Bearer $tenantToken" } -Session $tenantSession
    Assert-True $deleteBranch.success "branch delete should succeed after removing assigned user"

    Write-Step "Testing refresh token rotation and reuse detection"
    Test-RefreshReuse -GatewayUrl $GatewayUrl

    Write-Step "Checking outbox drain"
    Start-Sleep -Seconds $AsyncWaitSeconds
    $identityOutbox = docker exec identity-db psql -U identity_user -d identity_db -t -A -c "SELECT COUNT(*) FROM outbox_events WHERE processed_at IS NULL;" 2>$null
    $tenantOutbox = docker exec tenant-db psql -U tenant_user -d tenant_db -t -A -c "SELECT COUNT(*) FROM outbox_events WHERE processed_at IS NULL;" 2>$null
    Assert-True ([int]$identityOutbox.Trim() -eq 0) "identity outbox should be drained"
    Assert-True ([int]$tenantOutbox.Trim() -eq 0) "tenant outbox should be drained"

    Write-Host "`nSmoke test passed for tenant $subdomain ($tenantId)." -ForegroundColor Green
}
finally {
    Pop-Location
}
