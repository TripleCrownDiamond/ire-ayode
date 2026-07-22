---
name: hostinger-deploy
description: >
  Deploy PHP+SQLite or React+Vite projects to Hostinger shared hosting via
  FTP. Covers FTP credentials, OPcache clearing, .htaccess configuration,
  database path resolution, and common debugging patterns. Use whenever
  deploying to or debugging a Hostinger-hosted site.
---

# Hostinger Shared Hosting Deployment

Deployment guide for Hostinger shared hosting (PHP+SQLite or React+Vite projects).

## When to use

- Deploying code, database, or assets to a Hostinger-hosted site
- Debugging stale content (OPcache, wrong DB path)
- Configuring .htaccess for SPA routing or API rewrites
- Resolving FTP upload issues (530 errors, PASV failures)

## FTP connection

**Standard Hostinger credentials pattern**:
```
Host: 213.130.145.44
Port: 21
User: u160338490.<domain>
Pass: Azerty%1234#1234
```

**FTP directory layout** (critical — differs from expectations):
```
/ (FTP root)
├── public_html/          ← Apache document root
│   ├── index.html        ← SPA entry
│   ├── .htaccess         ← URL rewriting rules
│   ├── api/              ← PHP API files
│   ├── src/              ← PHP backend (bootstrap.php, commerce.php)
│   ├── data/             ← SQLite database (app.sqlite)
│   └── generated/        ← uploaded assets (images, etc.)
├── domains/              ← alternative layout (some accounts)
│   └── <domain>/
│       ├── public_html/  ← document root
│       └── src/          ← backend
```

**IMPORTANT**: The FTP root is NOT always the document root. `public_html/` is typically the Apache document root. API files using `dirname(__DIR__, 2)` may resolve to a DIFFERENT path than expected.

### Python FTP upload

```python
import ftplib, os

def deploy_file(ftp_host, ftp_user, ftp_pass, local_path, remote_path):
    ftp = ftplib.FTP()
    ftp.connect(ftp_host, 21, timeout=30)
    ftp.login(ftp_user, ftp_pass)
    
    # Ensure remote directory exists
    remote_dir = os.path.dirname(remote_path)
    try:
        ftp.mkd(remote_dir)
    except ftplib.error_perm:
        pass  # directory exists
    
    with open(local_path, "rb") as f:
        ftp.storbinary(f"STOR {remote_path}", f)
    ftp.quit()

# Usage
deploy_file(
    "213.130.145.44",
    "u160338490.example.com",
    "Azerty%1234#1234",
    "dist/index.html",
    "/public_html/index.html"
)
```

### curl FTP fallback (when Python ftplib PASV fails)

```bash
curl.exe -T local_file.php ftp://213.130.145.44/public_html/path/ \
  --user "u160338490.example.com:Azerty%1234#1234" --ftp-create-dirs
```

## Common issues and fixes

### 1. OPcache serves stale content

**Symptom**: Uploaded file but old content still served. PHP file size on server matches old version.

**Fix options**:
1. Upload a temp PHP script with `opcache_reset()`:
```php
<?php
opcache_reset();
echo "OPcache cleared at " . date('Y-m-d H:i:s');
// Self-delete after execution
unlink(__FILE__);
```
2. Wait for OPcache TTL (usually 60-300s on Hostinger)
3. Contact Hostinger support to restart PHP-FPM

### 2. .htaccess not working

**Symptom**: SPA routes return 404, API rewrites fail.

**Known limitations on Hostinger shared hosting**:
- `DirectoryIndex` directives may be ignored (PHP always takes priority)
- Some RewriteRule flags may not work
- `.htaccess` must be in the correct document root

**SPA routing .htaccess template**:
```apache
RewriteEngine On
RewriteBase /

# API rewrites
RewriteRule ^api/(.*)$ api/$1 [L,QSA]

# Admin panel
RewriteRule ^admin$ admin.php [L]

# SPA fallback (exclude static files)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|db|php)$
RewriteRule ^ index.html [L]
```

**If .htaccess doesn't work**: Make `index.php` serve `index.html` content for non-API routes (fallback pattern).

### 3. Database path confusion

**Symptom**: API returns old data despite uploading new DB.

**Root cause**: PHP files may resolve DB paths differently depending on:
- `dirname(__DIR__, N)` depth in require chains
- Whether the script is in `public_html/` vs domain root
- `APP_DB_PATH` constant defined in different bootstrap files

**Debugging**:
```php
<?php
echo "Script: " . __FILE__ . "\n";
echo "Dirname: " . dirname(__FILE__) . "\n";
echo "DB path: " . (defined('APP_DB_PATH') ? APP_DB_PATH : 'NOT DEFINED') . "\n";
if (file_exists(APP_DB_PATH ?? '')) {
    $db = new SQLite3(APP_DB_PATH);
    $count = $db->querySingle("SELECT COUNT(*) FROM products");
    echo "Product count: $count\n";
}
```

**Common DB locations**:
- `/public_html/data/app.sqlite` (most common)
- `/public_html/storage/database.sqlite`
- `/public_html/backend/db/*.db`
- Domain root `data/app.sqlite` (separate from public_html)

### 4. FTP 530 Login incorrect

**Cause**: Wrong credentials. The old hosting credentials may have been hardcoded in deploy scripts.

**Fix**: Verify credentials match the current Hostinger account. The pattern is `u160338490.<current_domain>` — NOT the old domain.

### 5. React SPA + PHP backend coexistence

**Pattern**: React Vite build outputs to `dist/`, PHP backend in `src/` or `backend/`.

**Deployment**:
1. Build React: `npm run build` → `dist/`
2. Upload `dist/index.html` → `/public_html/index.html`
3. Upload `dist/assets/` → `/public_html/assets/`
4. Upload PHP files → `/public_html/api/`, `/public_html/src/`
5. Upload `.htaccess` → `/public_html/.htaccess` (if deploy script doesn't handle it)

**viteSingleFile()**: If using this Vite plugin, all JS/CSS is bundled into `index.html`. External scripts (analytics, widgets) must be placed in static HTML, not injected via React modules.

## Debugging checklist

When a Hostinger deployment isn't working:

1. **Check FTP path**: Is the file actually in `public_html/`?
2. **Check PHP error log**: Upload `error_log` viewer or check via `tail /home/u160338490/logs/error.log`
3. **Check DB path**: Which bootstrap file is loaded? Which DB does it point to?
4. **Check OPcache**: Upload `opcache_reset.php` and execute
5. **Check .htaccess**: Is it in the document root? Are RewriteRules correct?
6. **Check domain resolution**: Is the domain pointing to the correct Hostinger server?
7. **Check file permissions**: SQLite DB must be writable by PHP (chmod 644 or 666)

## Session history references

- EMV REMORQUES deployment: sessions `ses_07feaeb60ffeCAY5OAksLDVj6m`, `ses_081863cc3ffeCCTWMOaPLV54V1`
- Vitri-Home deployment: session `ses_0806bb300ffea9kbTo2yXMIxjh`
- Valtis-Kapital deployment: session `ses_0858a224affe5EtD3ZgDct8BtA`
- VACHOME/Magis deployment: session `ses_084dd063bffeosmuhb42SpahVq`
