# Content Pattern — Weslaco Launch Package

This site follows **Content Convention v0.1** (Client CMS Platform, Phase 0).
Client-relevant copy lives in `content/*.json`; the page itself is generated
from `templates/index.template.html`. The deploy workflow is unchanged:
`index.html` is still a committed artifact, deployed by manual drag-drop
(via ship-site, on Danny's explicit go — never auto).

## Layout

```
content/
  schema.json        # blocks, fields, permissions — the site's contract with the portal
  global.json        # site-wide: contact/social + footer copy
  home.json          # homepage blocks (hero ... finalCta, in page order)
templates/
  index.template.html
build.js             # zero-dep Node: content + template -> index.html
verify.js            # zero-dep Node: validates + proves round-trip (exit 0/1)
admin/               # Sveltia CMS (loader + config.yml, mirrors schema permissions)
index.original.html  # pre-retrofit snapshot, kept until Danny signs off
index.html.backup    # older pre-existing backup, untouched
package.json         # pins "type": "commonjs" — the parent danielonpurpose/ folder is
                     # an ESM ("type": "module") Astro project and Node would otherwise
                     # treat build.js/verify.js as ES modules
```

## Editing content

1. Edit `content/home.json` or `content/global.json` (or use `/admin/` once the
   GitHub OAuth gateway is set up).
2. Rebuild: `node build.js` (rewrites `index.html`).
3. Check: `node verify.js` (must exit 0).
4. Commit both the content change and the regenerated `index.html`.

Template constructs (build.js implements ONLY these):
- `{{home.hero.tag}}` — scalar, HTML-escaped (`&`, `<`, `>`, `"`)
- `{{{path}}}` — raw scalar for trusted HTML (currently unused on this site)
- `{{#each home.packageCards.items}} ... {{/each}}` — repeat
- `{{#if path}} ... {{/if}}` — conditional (currently unused on this site)

## Bilingual fields (EN/ES)

The page has a language toggle driven by `data-en` / `data-es` attributes.
Every bilingual field exists twice in the content: `field` (English) and
`fieldEs` (Spanish). English values render twice in the HTML (in the `data-en`
attribute AND as the visible text) — the template handles that; just edit the
field once. A few blocks are English-only (lead-section call card, `finalCta`)
because the original page never gave them `data-es` attributes.

## Permissions (schema.json)

- `client-editable` — safe copy edits; these are the ONLY fields exposed in
  `/admin/` (Sveltia).
- `request-only` — links, phone `tel:` digits, email, social URLs. Change
  requests go through Danny; edit the JSON directly and rebuild.
- Layout chrome (nav, phone-mock graphic, footer services list, mobile bar,
  `<head>` metadata, CSS, JS) is hardcoded in the template on purpose.

## Known deviations from index.original.html (documented, sign-off pending)

`node build.js` output differs from `index.original.html` on exactly 3 lines:
the original wrote raw `&` inside `data-en="..."` attributes ("Check & Apply",
"Build & Launch", "eligibility & board approval") while writing `&amp;` in the
matching visible text. The build escapes uniformly, so those 3 attributes now
read `&amp;`. Browsers decode both to the same DOM; the language toggle behaves
identically.

## Do not

- Do not push or deploy from here without Danny's explicit go (ship-site only).
- Do not hand-edit `index.html` — it gets overwritten by `node build.js`.
- Do not "fix" copy (e.g. the 4-Hour On-Site Onboarding claims) — copy
  reconciliation is Danny's call.
