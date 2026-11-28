# BudgetGenius project instructions

## Git workflow

- **Never work or push directly on `main`.** Before the first edit of a task, run
  `git rev-parse --abbrev-ref HEAD` and check the remote state. If the branch is
  `main`, stop and ask the user, then create a dedicated branch
  (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and make the change there.
- Commits and pushes go to that branch. Pushing or merging to `main` only happens
  when the user explicitly asks for it in that message.
- If the user explicitly asks to commit on `main`, do it, but say so in the reply.

## Commits

- **No attribution.** Never add `Co-Authored-By`, `Generated with`, `Codebuff`, or any other AI/tool trailer or signature to a commit. The commit message must contain only the user's message text and nothing else.
- Use the user's configured Git identity. Do not set an AI author or committer.
- Do not commit unless the user explicitly asks.
- Follow the repository's existing commit-message style; keep the message concise and explain why the change was made.

## Changelog

Every release updates **both** changelogs, in the same commit as the version
bump — a shipped version whose changelog is older is a bug, not a follow-up:

- **`apps/webClient/src/presentation/data/changelog.ts`** is the user-facing
timeline. The landing `/changelog` page and the in-app “what’s new” both read
it. Newest first, `version` is `major.minor`, title and description in English
and Spanish, plain language (“what you can now do”, no jargon), and
`highlight: true` moves to the new entry.
- **`docs/changelog.md`** is the engineering log: exact version, date, and one
line per commit with its hash.

When you add a user-visible change outside a release branch, add the entry in
the branch that ships it — do not leave it for later.

## Design and UI

- Read `DESIGN.md` before changing the landing or the public UI.
- Use the project's design tokens, fonts and component patterns.
- Landing icons come from `@animateicons/vanilla/lucide`; app icons come from `@animateicons/react` through `apps/webClient/src/presentation/components/ui/animated-icons.tsx`. Icons animate on the parent component's hover, not only on the icon's own hover. Do not add hand-drawn SVG icon paths or import `lucide-react`.
- Impeccable is an assistant-side account skill. Do not install its `.claude`/`.cursor` agents or skills into this repository, and do not commit local agent folders or screenshots.
