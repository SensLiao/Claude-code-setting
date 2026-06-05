#!/usr/bin/env node
// disc-robots-sitemap-guard — PreToolUse(Edit|Write) hook (block-obvious, exit 2)
// L12 Discoverability harness contract §7.3.
//
// Hard-blocks only the 5 obvious mistakes when writing robots / sitemap / llms.txt:
//   1. Production robots.txt with "User-agent: *\nDisallow: /" full-site deny
//      without "// allow-prod-deny" sentinel.
//   2. sitemap.xml content that fails minimal XML structure check (no <urlset
//      or <sitemapindex root element).
//   3. sitemap.xml content listing a URL matching denied-private-route patterns
//      (/admin, /api/internal, /auth/, /preview/, /staging, ?token=, ?api_key=).
//   4. llms.txt content containing private routes or token-bearing query strings.
//   5. robots.txt Disallow directive targeting private routes — flag as
//      "robots is NOT access control; handoff to AppSec".
//
// Pass-through (exit 0) for any other edit, including ordinary robots/sitemap
// changes. We're deliberately conservative — false positives are worse than
// false negatives here since the deploy-gate hook is the real safety net.

'use strict';

const path = require('path');
const {
  readInputSafe,
  preflight,
  PRIVATE_ROUTE_PATTERNS,
  preToolBlockMessage,
} = require('./_disc-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  // Blocking hook: fail-closed on stdin parse error.
  preToolBlockMessage(`robots-sitemap-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}
const safeInput = input || {};

const pre = preflight(safeInput);
if (pre.mode === 'silent' || pre.mode === 'disabled') process.exit(0);
if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`robots-sitemap-guard fail-closed: ${pre.reason}`);
  process.exit(2);
}

const harness = (pre.config && pre.config.harness) || {};
const hookModes = harness.hook_modes || {};
if (hookModes.robots_sitemap_guard === 'off') process.exit(0);

// Only act on Edit / Write
const toolName = safeInput.tool_name || safeInput.tool || '';
if (toolName !== 'Edit' && toolName !== 'Write' && toolName !== 'MultiEdit') process.exit(0);

const tinp = safeInput.tool_input || {};
const filePath = tinp.file_path || tinp.path || '';
if (!filePath) process.exit(0);

// Identify file kind
const fp = String(filePath).replace(/\\/g, '/').toLowerCase();
const isRobotsTxt  = /(^|\/)(public\/)?robots\.txt$/.test(fp);
const isRobotsTs   = /(^|\/)app\/robots\.(ts|tsx|js|jsx)$/.test(fp);
const isSitemapXml = /(^|\/)(public\/)?sitemap[^\/]*\.xml$/.test(fp);
const isSitemapTs  = /(^|\/)app\/sitemap(\.|\/)/.test(fp);
const isLlmsTxt    = /(^|\/)(public\/)?llms(-full)?\.txt$/.test(fp);

if (!isRobotsTxt && !isRobotsTs && !isSitemapXml && !isSitemapTs && !isLlmsTxt) {
  process.exit(0);
}

// Extract content (Write uses `content`; Edit uses `new_string`).
const content = (typeof tinp.content === 'string' && tinp.content) ||
                (typeof tinp.new_string === 'string' && tinp.new_string) ||
                '';
if (!content) process.exit(0);  // can't analyze without content

const warnMode = (pre.mode === 'warn') || (hookModes.robots_sitemap_guard === 'warn');

function blockOrWarn(reason) {
  if (warnMode) {
    process.stderr.write(`[disc-robots-sitemap-guard] WARN: ${reason}\n`);
    process.exit(0);
  }
  preToolBlockMessage(`robots-sitemap-guard BLOCKED: ${reason}`);
  process.exit(2);
}

// Helper: check content for private-route URL strings.
function findPrivateUrl(text) {
  for (const re of PRIVATE_ROUTE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

// ───── Scenario 1: robots.txt full-site deny on User-agent: * ─────
if (isRobotsTxt || isRobotsTs) {
  const sentinel = /\/\/\s*allow-prod-deny|#\s*allow-prod-deny/i.test(content);
  // Look for User-agent: * followed (within 5 lines) by Disallow: /
  const ua = /^[ \t]*User-agent\s*:\s*\*\s*$/im;
  const denyAll = /^[ \t]*Disallow\s*:\s*\/\s*$/im;
  if (ua.test(content) && denyAll.test(content) && !sentinel) {
    blockOrWarn(
      'robots.txt full-site deny detected (User-agent: * + Disallow: /). ' +
      'If intentional for staging/preview, add comment "// allow-prod-deny" (or "# allow-prod-deny" for robots.txt). ' +
      'In production this hides the entire site from all crawlers.'
    );
  }

  // Scenario 5: Disallow directive targets private routes — handoff AppSec.
  const disallowLines = content.match(/^[ \t]*Disallow\s*:\s*\S+\s*$/gim) || [];
  for (const line of disallowLines) {
    const target = line.replace(/^[ \t]*Disallow\s*:\s*/i, '').trim();
    for (const re of PRIVATE_ROUTE_PATTERNS) {
      if (re.test(target)) {
        blockOrWarn(
          `robots.txt Disallow targets private route '${target}'. ` +
          `robots.txt is NOT access control — crawlers that ignore it (and any human) can still reach this path. ` +
          `Handoff to appsec-security-orchestrator for actual access control (auth / network / WAF). ` +
          `If the path is genuinely public and you only want crawler hint, re-route via meta noindex on the page, not robots.txt Disallow.`
        );
      }
    }
  }
}

// ───── Scenario 2 + 3: sitemap.xml structural + private-route check ─────
if (isSitemapXml) {
  const hasRoot = /<urlset[\s>]/i.test(content) || /<sitemapindex[\s>]/i.test(content);
  if (!hasRoot) {
    blockOrWarn(
      'sitemap.xml content is missing required root element (<urlset> or <sitemapindex>). ' +
      'Either the file is malformed or this is not a real sitemap. Reject.'
    );
  }
  // Extract <loc>...</loc> URLs and check each
  const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = locRe.exec(content)) !== null) {
    const url = m[1];
    for (const re of PRIVATE_ROUTE_PATTERNS) {
      if (re.test(url)) {
        blockOrWarn(
          `sitemap.xml lists private route URL: '${url}'. ` +
          `Listing private URLs in a sitemap actively invites search engines to index them. ` +
          `Remove the URL from the sitemap, and (if it's truly private) ensure proper access control via appsec.`
        );
      }
    }
  }
}

// ───── Scenario 4: llms.txt private-route / token-URL check ─────
if (isLlmsTxt) {
  const leaked = findPrivateUrl(content);
  if (leaked) {
    blockOrWarn(
      `llms.txt content contains private/sensitive URL fragment: '${leaked}'. ` +
      `llms.txt is crawled by AI search engines; never list internal/admin/preview/token-bearing URLs here. ` +
      `If this is intentional, remove the token/private path. Handoff to appsec if the path is genuinely confidential.`
    );
  }
}

// All checks passed
process.exit(0);
