<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on this repo

**Use npm.** There is a `package-lock.json`; reaching for another package manager
relocates `better-sqlite3` and leaves a server that starts and then cannot open
its database.

**After any install, expect the native module to be gone.** This machine's global
npm config sets `ignore-scripts=true` — a deliberate safety setting that stays as
it is; do not edit it, and do not add a project `.npmrc` that overrides it. The
side effect is that `better-sqlite3` never runs the install step that produces
its binary. Symptom: a wall of "Could not locate the bindings file" from the
skill-state tests, or a dashboard that boots and then cannot open its database.
Cure, scoped to that one package and that one command:

```
npm rebuild better-sqlite3 --ignore-scripts=false
```

The flag applies to that invocation only and changes no configuration. Copying
the built file back from somewhere else also works and is what happened the
first time this bit — it treats the symptom, and the next install undoes it. CI
is unaffected: the setting is local to this machine.

**Before pushing, run `npm run verify`** (lint, both typechecks, tests). It is
the same set CI runs, so a red result here is a red result there.
