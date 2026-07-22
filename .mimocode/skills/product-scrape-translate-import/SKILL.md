---
name: product-scrape-translate-import
description: >
  Scrape products from a source WooCommerce/WordPress site, translate names
  and descriptions to the target language via word-level dictionary, import
  into a PHP+SQLite backend, and deploy to production. Covers the full
  pipeline: discovery, scraping, translation passes, DB import, FTP deploy,
  and verification. Use when migrating or syncing product catalogs between
  multilingual e-commerce sites.
---

# Product Scrape → Translate → Import → Deploy

End-to-end pipeline for migrating products between e-commerce sites with language translation.

## When to use

- User asks to scrape products from site A and import to site B
- Products need translation from source language to target language
- Target site uses PHP+SQLite backend (Hostinger shared hosting)
- WooCommerce REST API may be blocked (401) — plan for HTML scraping fallback

## Pipeline steps

### 1. Reconnaissance

Before writing any code, gather:

- **Source site**: URL, platform (WordPress/WooCommerce, Shopify, custom), language, product count, URL patterns
- **Source API test**: Try `/wp-json/wc/v3/products` first — if 401, plan HTML scraping
- **Target site**: URL, backend type (PHP+SQLite, Node, etc.), DB schema, existing products
- **Category mapping**: Source categories → target categories (hardcoded dictionary)
- **Translation direction**: Source lang → target lang (e.g., DE→IT, NL→FR, DE→FR)

Document findings in session notes before proceeding.

### 2. Scraping

**If WooCommerce REST API works** (auth available):
```python
# Use requests with auth
resp = requests.get(f"{base_url}/wp-json/wc/v3/products", auth=(ck, cs), params={"per_page": 100})
```

**If API is blocked** (common on Hostinger sites — 401):
```python
# HTML scraping with requests + BeautifulSoup
from bs4 import BeautifulSoup
import requests, time

def safe_get(url, retries=3, delay=5):
    for i in range(retries):
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r
        except Exception as e:
            if i < retries - 1:
                time.sleep(delay * (i + 1))
            else:
                raise
```

**Key scraping patterns**:
- Product listing: paginated (`/page/N/`), extract slugs/URLs
- Product detail: name (`<h1 class="product_title">`), price (`.price`), images (`.wp-post-image`, gallery `href`), specs (`<tr>` tables)
- **Rate limiting**: Hostinger resets connections after ~30 rapid requests. Use `safe_get()` with retry + exponential backoff. Add 1-2s delay between requests.
- **Save progress**: Write intermediate results to JSON after each batch (25-50 products) for resume capability
- **Batch scraping**: Split into runs of 25 products to avoid timeouts

### 3. Translation (word-level dictionary)

**Critical: Always use word-boundary regex** (`\b...\b`). Without it, partial matches destroy text:
- `"staal"→"acier"` inside `"Cortenstaal"` becomes `"Cortenacier"` ❌
- `"dan"→"dans"` inside `"container"` becomes `"contadanser"` ❌

**Multi-pass approach**:
```
Pass 1: ~200 common word mappings (core vocabulary)
Pass 2: ~300 additional mappings (compound words, technical terms)
Pass 3+: targeted passes for remaining untranslated words
```

**Translation script template**:
```python
import re, sqlite3

MAPPINGS = {
    r"\bslot\b": "serrure",
    r"\bheftruck\b": "chariot élévateur",
    # ... more mappings
}

def translate_text(text, mappings):
    for pattern, replacement in mappings.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text

# Apply to all products
conn = sqlite3.connect("database.sqlite")
cursor = conn.execute("SELECT id, short_desc FROM products WHERE short_desc IS NOT NULL")
for row in cursor:
    translated = translate_text(row[1], MAPPINGS)
    if translated != row[1]:
        conn.execute("UPDATE products SET short_desc=? WHERE id=?", (translated, row[0]))
conn.commit()
```

**Verification**: After each pass, scan for remaining source-language words:
```python
def find untranslatedWords(text, known_words, min_length=5):
    words = re.findall(r'\b\w+\b', text.lower())
    return [w for w in words if len(w) >= min_length and w not in known_words]
```

**Deploy after each pass** — verify on production before continuing.

### 4. DB Import

**Target DB pattern** (PHP+SQLite on Hostinger):
```python
import sqlite3

conn = sqlite3.connect("database.sqlite")
conn.execute("""INSERT OR REPLACE INTO products 
    (name, slug, category, type, price, short_desc, long_desc, image_url, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", 
    (name, slug, category, type, price, short_desc, long_desc, image_url, source_url))
conn.commit()
```

**Key rules**:
- Use `source_url` for deduplication (avoid duplicate imports)
- Product IDs: start at 9000000+ to avoid collision with existing products
- Translate category names to target language
- Update `gallery_json` and `specs_json` fields if present

### 5. FTP Deploy

**Hostinger FTP pattern**:
```python
import ftplib

ftp = ftplib.FTP()
ftp.connect("213.130.145.44", 21, timeout=30)
ftp.login("u160338490.<domain>", "Azerty%1234#1234")
ftp.cwd("/public_html/storage")  # or wherever DB lives
with open("database.sqlite", "rb") as f:
    ftp.storbinary("STOR database.sqlite", f)
ftp.quit()
```

**Common issues**:
- FTP PASV may fail on Hostinger — use active mode or curl
- OPcache may serve stale PHP — upload `opcache_reset.php` or wait for TTL
- DB path varies by project: `storage/database.sqlite`, `data/app.sqlite`, `backend/db/*.db`

### 6. Verification

1. Check API endpoint returns updated product count
2. Spot-check 10+ products for correct translation
3. Verify no source-language text remains (grep/regex scan)
4. Test product images load correctly
5. Check homepage/category pages display new products

## Anti-patterns to avoid

- **Never skip word-boundary regex** in translation — it WILL destroy product names
- **Never import without backup** — always keep original scraped data in JSON
- **Never assume API access** — always test first, plan HTML scraping fallback
- **Never deploy without verification** — always spot-check on production
- **Never use naive `str.replace()`** — always use regex with `\b` boundaries

## Session history references

- Vitri-Home containerslot.net import: sessions `ses_0806bb300ffea9kbTo2yXMIxjh`, `ses_080d458c2ffe3j6rhQTLLWEpFT`
- EMV REMORQUES ermatransport import: sessions `ses_07feaeb60ffeCAY5OAksLDVj6m`, `ses_07f15cd09ffeuR9jH5eOpJkG7f`
- Rasenmaeher-Shop scraping: sessions `ses_088bfe4a2ffe4jtA6089VyaXtk`, `ses_0895aac07ffe0zCd1BgreOgMZY`, `ses_085ebb5a6ffeiTd9RX3dLxveWU`
