// Turns the legal text in src/data/legal.ts into plain web pages in docs/, ready
// to host for free (GitHub Pages, Netlify…) so the app stores have links to them.
// Run from the PantryGo folder after changing the text:
//   npx tsx scripts/build-legal-pages.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONTACT_EMAIL, LEGAL_DOCS, hasContactEmail } from "../src/data/legal.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const PAGES: Record<string, string> = {
  privacy: "privacy.html",
  terms: "terms.html",
  "delete-account": "delete-account.html",
  licences: "licences.html",
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Turn web addresses and the contact email into links
const linkify = (s: string) =>
  escape(s)
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');

const STYLE = `
  :root { --bg:#F3F6F2; --surface:#fff; --text:#1B2A24; --soft:#5E7168; --primary:#1E5C45; --border:#DCE5DE; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0F1A16; --surface:#17241F; --text:#E6EFE9; --soft:#93A79E; --primary:#7FD1A3; --border:#2A3B34; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  header { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
  header a { color:var(--primary); font-weight:700; text-decoration:none; font-size:18px; }
  h1 { font-size:30px; line-height:1.2; margin:0 0 4px; }
  .updated { color:var(--soft); margin:0 0 24px; font-size:14px; }
  section { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 20px; margin-bottom:14px; }
  h2 { font-size:19px; margin:0 0 8px; }
  p { margin:0 0 10px; } p:last-child { margin-bottom:0; }
  a { color:var(--primary); }
  nav { margin-top:28px; display:flex; flex-wrap:wrap; gap:16px; font-size:14px; }
  .warn { background:#FFF4D6; color:#6B4E00; border-radius:12px; padding:12px 14px; margin-bottom:16px; font-size:14px; }`;

function page(title: string, inner: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · PantryGo</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header><a href="index.html">PantryGo</a></header>
${hasContactEmail() ? "" : '<p class="warn">Draft: the contact email hasn\'t been filled in yet (src/data/legal.ts).</p>'}
${inner}
<nav>${Object.entries(PAGES)
    .map(([key, file]) => `<a href="${file}">${escape(LEGAL_DOCS[key].title)}</a>`)
    .join("")}</nav>
</main>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const [key, file] of Object.entries(PAGES)) {
  const doc = LEGAL_DOCS[key];
  const inner = `<h1>${escape(doc.title)}</h1>
<p class="updated">Last updated ${escape(doc.updated)}</p>
${doc.sections
  .map(
    (s) =>
      `<section><h2>${escape(s.heading)}</h2>${s.body.map((p) => `<p>${linkify(p)}</p>`).join("")}</section>`,
  )
  .join("\n")}`;
  writeFileSync(join(OUT, file), page(doc.title, inner));
}
writeFileSync(
  join(OUT, "index.html"),
  page(
    "PantryGo",
    `<h1>PantryGo</h1>
<p class="updated">Share a pantry and shopping list with the people you live with, cook from what you have, and waste less food.</p>
<section><h2>Support</h2><p>${
      hasContactEmail()
        ? `Questions or problems? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`
        : "Contact email coming soon."
    }</p></section>`,
  ),
);
console.log(`Wrote ${Object.keys(PAGES).length + 1} pages to docs/`);
