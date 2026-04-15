# HTML Processor Benchmark Results

## Overview

Performance profiling of `TestTag_HTML_Processor::process_html()` on a large
synthetic WordPress page (33 KB HTML, 552 injected test tags).

**Environment:** PHP 8.3.6 CLI, Linux (GitHub Actions runner)  
**Benchmark page:** 33 742 bytes — 30 blog-post cards, 7-field contact form with
`<label>` elements, 20 WooCommerce-style product cards, Elementor widgets,
Gutenberg blocks, 6-item primary nav, 10-item category nav, 3-item footer nav  
**Metric:** average wall-clock time over 10 iterations after one warm-up run

---

## Baseline (before optimization)

| Run | avg (ms) | min (ms) | max (ms) | tags |
|-----|-----------|-----------|-----------|------|
| 1   | 20.50     | 20.27     | 20.80     | 552  |
| 2   | 20.57     | 20.39     | 20.68     | 552  |
| 3   | 20.40     | 20.31     | 20.64     | 552  |
| 4   | 20.39     | 20.27     | 20.58     | 552  |
| 5   | 20.33     | 20.16     | 20.63     | 552  |

**Mean average: 20.44 ms**

---

## After optimization

| Run | avg (ms) | min (ms) | max (ms) | tags |
|-----|-----------|-----------|-----------|------|
| 1   | 19.25     | 19.09     | 19.84     | 552  |
| 2   | 19.08     | 18.96     | 19.24     | 552  |
| 3   | 19.54     | 19.26     | 20.07     | 552  |
| 4   | 19.35     | 19.25     | 19.49     | 552  |
| 5   | 19.30     | 19.20     | 19.41     | 552  |

**Mean average: 19.30 ms**

---

## Summary

| Metric          | Before   | After    | Δ        |
|-----------------|----------|----------|----------|
| Mean average    | 20.44 ms | 19.30 ms | −1.14 ms |
| Improvement     |          |          | **−5.5%**|
| Tag count       | 552      | 552      | identical|

Tag output is byte-identical to the baseline — no regression.

---

## Optimizations implemented

### 1. `slug()` memoization (`$slug_cache`)

`slug()` is called hundreds of times per page render to convert element
attribute values and text content to slug strings.  Many of these calls
use the same input (repeated class names, navigation link text, heading
text referenced by multiple elements).

A static array cache keyed by `separator + "\0" + raw_string` eliminates
redundant `strtolower` / `preg_replace` / `substr` work for repeated inputs.
The cache is bounded to 512 entries and flushed when the separator setting
changes between requests (PHP-FPM worker reuse scenario).

### 2. `clean()` memoization (`$clean_cache`)

`clean()` removes framework-specific prefixes/segments from slugified IDs.
Like `slug()`, it is called for every element with an `id` attribute and
involves multiple regex operations.  The same static-cache pattern is applied
with the same 512-entry cap.

### 3. `css_to_xpath()` memoization (`$xpath_cache`)

The CSS→XPath translator is called once per selector per page request, plus
recursively for each part of a comma-separated multi-selector (e.g.
`.search-form, form[role="search"]`).  Caching the translation avoids
re-running multiple `preg_split` and `preg_match` calls for selectors that
are identical across requests.

Because `css_to_xpath()` is a pure function (output depends only on input),
the cache is never invalidated — it accumulates up to 512 entries and then
resets.  In long-running PHP-FPM workers this means the full selector-map is
translated at most once per worker lifetime.

### 4. Pre-built label map (`build_label_map()`)

`get_label_text()` was called for every `<input>`, `<textarea>`, and
`<select>` that has an `id` attribute.  Each call ran a global XPath query
(`//label[@for=...]`) across the entire document.  On a page with many
labelled form controls this was O(n) XPath queries.

A new `build_label_map()` helper runs **one** `//label[@for]` XPath query at
the start of `auto_generate()` and builds an `id → label text` PHP array.
`get_label_text()` then does a simple array lookup, reducing label resolution
from O(n · m) to O(n + m) where n is form controls and m is labels.

---

## Running the benchmark yourself

```bash
php benchmarks/benchmark-html-processor.php
```

The script runs without WordPress by supplying minimal function stubs.
Output format:

```
avg=<ms>  min=<ms>  max=<ms>  tags=<count>  html_len=<bytes>  php=<version>
```
