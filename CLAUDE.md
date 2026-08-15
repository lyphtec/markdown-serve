# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`markdown-serve` is a published npm library (not an app): it serves a directory of Markdown files over HTTP, either as an Express middleware or via a standalone `MarkdownServer` class. There is no build step and no linter configured — plain CommonJS, ES5-style `var`/prototype code throughout.

## Commands

```bash
npm test
```

Run a single test file:

```bash
npx mocha test/resolver.test.js
```

Run a single test by name:

```bash
npx mocha test/*.test.js --grep "should resolve"
```

Note: `test/mocha.opts` is dead config — Mocha 8 removed `mocha.opts` support, so `test/bootstrap/node.js` is never loaded. Each test file calls `require('chai').should()` itself, which is why the suite still passes. Don't rely on globals from the bootstrap file.

## Architecture

Three layers, each a separate module, called in sequence:

1. **[lib/resolver.js](lib/resolver.js)** — pure URL-path → filesystem-path function. Given `/some/path`, tries a cascade of candidates against `rootDir`: exact `path.md`, dashes-as-spaces `path.md`, `path/index.md`, then a segment-by-segment walk that retries each segment with dashes replaced by spaces. Returns the absolute file path or `null`. All lookups are synchronous `fs.existsSync`.

   Every candidate goes through `contained()` before it is returned, which rejects anything that resolves outside `rootDir`. `req.path` still holds percent-escapes when it reaches the resolver, so `%2e%2e%2f` decodes to `../` here — without that guard the middleware serves arbitrary files off disk. `MarkdownServer.save()` imports the same helper for the path it builds for not-yet-existing files. Keep both call sites guarded.
2. **[lib/parser.js](lib/parser.js)** — reads the file, splits YAML front-matter from Markdown body, exposes `MarkdownFile`. Front-matter detection is heuristic: the content is split on `---`, and the first chunk is fed to `yaml.load()`; if it doesn't parse, the file is treated as having no front-matter (because `---` is also a valid Markdown `<hr>`). Bodies containing `---` are rejoined, so a horizontal rule mid-document survives.
3. **[lib/server.js](lib/server.js)** — `MarkdownServer` (`get`/`save`) plus the `middleware(options)` factory. [index.js](index.js) just re-exports this module.

### MarkdownFile contract

`parseContent()` is a *method*, not a property — HTML conversion is deliberately lazy so consumers can inspect `meta` (e.g. a `draft` flag) before paying for the parse. It works both sync (returns the string) and callback-style. The sync form must never throw: the middleware calls it from inside an `fs.readFile` callback, where a throw is uncatchable by Express and kills the process, so an empty file returns `''` there while the callback form still reports an error. Three middleware options exist purely to work around view engines that can't call methods on a view model:

- `view` alone → `res.render(view, { markdownFile })`
- `view` + `preParse: true` → also sets `markdownFile.parsedContent`
- `view` + `preParse: fn` → the function's return value becomes the whole view model
- `handler: fn` → full control; **ignored if `view` is also set** (`view` takes precedence)
- neither → JSON response of the `MarkdownFile`, with `parsedContent` populated

`_file` (the absolute filesystem path) and `stats` (the raw `fs.Stats`, which carries `uid`/`gid`/`ino`/`dev`/`mode`) are both deleted from the result before it leaves the middleware — they're information-disclosure risks, and the default JSON branch serialises whatever is left on the object. Keep it that way if you touch that code path; `created`, `modified` and `size` are promoted by the parser and remain available. `MarkdownServer.get()` used directly still returns both; tests depend on this.

### resolverOptions

`defaultPageName` (default `index`), `fileExtension` (default `md`, leading dot optional), and `useExtensionInUrl` (default `false`; when true the resolver appends no extension, so the URL must carry it). Note that the segment-walk fallback in the resolver hardcodes `.md` rather than honouring `fileExtension` — custom extensions only resolve via the earlier direct-match branches.

## Tests

Mocha + Chai `should` style, with `supertest` driving a real Express app for the middleware tests and `pug` views under [test/views](test/views). Fixtures in [test/fixture](test/fixture) cover the resolver's edge cases deliberately — spaces in folder and file names, dashed URLs, missing front-matter, Jekyll-style front-matter, custom extensions. Adding a fixture file can change the behaviour of unrelated resolver tests, so prefer new names over editing existing ones.

The `save()` tests write into the fixture tree. `test/fixture/server-new.md` and `test/fixture/new/` are gitignored, but `test/fixture/server-update.md` is tracked and gets rewritten on every run — it will show as modified in `git status` after `npm test`. That's expected; don't commit the churn unless the fixture genuinely changed.

## Conventions

- Public API surface is documented with JSDoc; the published API docs at <https://lyphtec.github.io/markdown-serve> are generated from these comments. Update the JSDoc block when changing a signature or option.
- Errors reach callers via the `callback(err)` convention, never thrown, except for genuine programmer errors in constructors/factories (`new MarkdownServer(badDir)`, `middleware()` with no `rootDirectory`), which throw synchronously.
- Bump `version` in [package.json](package.json) when publishing; `.npmignore` keeps `test/` and docs out of the tarball.
