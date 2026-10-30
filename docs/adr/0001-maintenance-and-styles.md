# 0001: Reduce maintenance context before changing the styling stack

Date: 2026-10-30. Status: accepted for the maintenance branch; no release/installation implied.

## Context and decision

The user wants updates to require less reading and model context. Mandatory context/plan initially held about 49,300 whitespace-delimited words, including obsolete delivery states. The app already has CSS variables/shared classes and browser/Node pure models.

- Keep current context/backlog concise; preserve historical evidence separately, read on demand.
- Refactor in behavior-preserving slices with clear ownership, shared domain rules and documented interfaces. Do not compress source or rewrite everything at once to lower line counts.
- Keep CSS in this slice. Tailwind is a styling authoring/build tool, not a fix for server architecture or oversized continuity documents.
- Use `codex/architecture-review`. A branch protects main history, not physical hardware from running code; tests use isolated data/backends. Merge/release/install are separate actions.

## Tailwind assessment

The official [CLI guide](https://tailwindcss.com/docs/installation/tailwind-cli) describes scanning source classes and generating static CSS. It can be development-only, with no production JS service or CDN, and can coexist with existing CSS.

Costs here: build dependencies/step, migration of semantic classes, class detection, and visual changes from [Preflight](https://tailwindcss.com/docs/preflight). [Detection](https://tailwindcss.com/docs/detecting-classes-in-source-files) needs complete class tokens; dynamic theme colors should retain CSS variables. Check [browser requirements](https://tailwindcss.com/docs/compatibility), including phones.

Future pilot: one real screen, pinned development-only dependencies, locally generated CSS, scoped utilities and no global reset initially. Compare markup + CSS + compressed sizes, build reproducibility, PT/EN/mobile screenshots and maintenance steps. Adopt only with demonstrated value; no promise of RAM/CPU or exact token savings. React/Vite or full migration is not required.

## First slice

Separate fan configuration validation from execution; share interpolation between graph/controller. Named modules can increase physical lines while reducing duplicated knowledge. Existing HTTP/browser contracts remain the test surface. No safety/schema change or dependency added.

Next slices: [plan](../PLANO-MELHORIAS.md). Interfaces/test map: [architecture](../ARCHITECTURE.md). This decision can change after a measured pilot; it does not prohibit Tailwind.
