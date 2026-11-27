#!/usr/bin/env node
/**
 * Automatic release version bump (knowledge.md §16).
 *
 * Reads the commits since the last `v*` tag, classifies them with Conventional
 * Commits and bumps the root `package.json` version accordingly:
 *
 *   breaking (`feat!:`, `BREAKING CHANGE:` footer)  → major   1.13.0 → 2.0.0
 *   `feat:`                                          → minor   1.13.0 → 1.14.0
 *   `fix:`, `perf:`, `refactor:`, `style:`, `build:` → patch   1.13.0 → 1.13.1
 *   `docs:`, `chore:`, `ci:`, `test:`                → none    (nothing to ship)
 *
 * Any subject without a type counts as a patch: it is a change, just not one
 * that follows the convention. Merge commits are ignored (`--no-merges`), so a
 * branch is judged by the commits it actually carried.
 *
 * When a bump is decided, the matching `## [vX.Y.Z]` section is prepended to
 * `docs/changelog.md`, which is what `release-android.yml` publishes as the
 * release body. `docs:`-only ranges write nothing and print `none`.
 *
 * A version already ahead of the last tag means someone bumped by hand: the
 * script leaves it alone (nothing to add) instead of bumping on top of it.
 *
 * Usage:
 *   node scripts/version-bump.mjs            # write package.json + changelog
 *   node scripts/version-bump.mjs --dry-run  # report only
 *
 * CI: appends `bump`, `version`, `tag` and `previous` to `$GITHUB_OUTPUT`.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = join(root, "package.json");
const changelogPath = join(root, "docs/changelog.md");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Usage: node scripts/version-bump.mjs [--dry-run]",
      "",
      "Bumps the root package.json version from the Conventional Commits since",
      "the last v* tag (major / minor / patch; docs-only changes do not bump)",
      "and prepends the matching docs/changelog.md entry.",
    ].join("\n"),
  );
  process.exit(0);
}

function git(argv) {
  return execFileSync("git", argv, { cwd: root, encoding: "utf8" }).trim();
}

function tryGit(argv) {
  try {
    return git(argv);
  } catch {
    return null;
  }
}

/**
 * Highest `vX.Y.Z` tag reachable from HEAD, or null on a repository without
 * tags. Sorted by version and not by commit distance: an old hotfix tag on a
 * side branch must not become the anchor of the next release.
 */
function lastTag() {
  const raw = tryGit(["tag", "--list", "v[0-9]*", "--merged", "HEAD"]);
  if (!raw) return null;

  const tags = raw
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+(\.\d+)*$/.test(tag));

  if (!tags.length) return null;
  return tags.sort(compareVersions).at(-1);
}

function versionParts(raw) {
  return String(raw)
    .trim()
    .replace(/^v/i, "")
    .split(/[-+]/)[0]
    .split(".")
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

/** Negative when `a` is older, positive when newer, 0 when equal. */
function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function bumpVersion(version, type) {
  const [major, minor, patch] = versionParts(version);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const LEVELS = { none: 0, patch: 1, minor: 2, major: 3 };
const LEVEL_NAMES = ["none", "patch", "minor", "major"];

/**
 * One commit → the release it implies.
 *
 * `section` is where the change belongs in the changelog; `docs`, `chore`,
 * `ci` and `test` produce `none`, which is what makes a docs-only push leave
 * the version untouched.
 */
function classify(subject, body) {
  const match = /^(\w+)(?:\([^)]*\))?(!)?:\s+(.+)$/.exec(subject);
  const breaking =
    Boolean(match?.[2]) || /^BREAKING[ -]CHANGE:/m.test(body ?? "");

  // The changelog bullet reads better without the `type(scope): ` prefix.
  const summary = match ? match[3].trim() : subject.trim();

  if (breaking) {
    return { level: LEVELS.major, section: "Changed", breaking: true, summary };
  }

  if (!match) {
    // Unconventional subject: a change without a declared kind still ships.
    return {
      level: LEVELS.patch,
      section: "Changed",
      breaking: false,
      summary,
    };
  }

  switch (match[1].toLowerCase()) {
    case "feat":
      return {
        level: LEVELS.minor,
        section: "Added",
        breaking: false,
        summary,
      };
    case "fix":
      return {
        level: LEVELS.patch,
        section: "Fixed",
        breaking: false,
        summary,
      };
    case "perf":
    case "refactor":
    case "style":
    case "build":
    case "revert":
      return {
        level: LEVELS.patch,
        section: "Changed",
        breaking: false,
        summary,
      };
    default:
      // docs, chore, ci, test and anything else not shipped on its own.
      return { level: LEVELS.none, section: null, breaking: false, summary };
  }
}

/** `\x1f` separates fields, `\x1e` separates records (bodies span lines). */
function readCommits(range) {
  const raw = tryGit([
    "log",
    range,
    "--no-merges",
    "--format=%H%x1f%s%x1f%b%x1e",
  ]);
  if (!raw) return [];

  return (
    raw
      .split("\x1e")
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, subject, body] = record.split("\x1f");
        return { hash, subject: subject?.trim() ?? "", body: body ?? "" };
      })
      .filter((commit) => commit.hash && commit.subject)
      // The release commit itself is never part of the next release.
      .filter((commit) => !/^chore:\s+bump version to v/i.test(commit.subject))
  );
}

function readVersion() {
  const match = /^\s*"version":\s*"([^"]+)"/m.exec(
    readFileSync(packagePath, "utf8"),
  );
  if (!match) throw new Error('Could not read "version" from package.json');
  return match[1];
}

/** Rewrites only the version line so the file keeps its formatting. */
function writeVersion(version) {
  const source = readFileSync(packagePath, "utf8");
  const next = source.replace(
    /^(\s*"version":\s*")[^"]+(")/m,
    `$1${version}$2`,
  );
  writeFileSync(packagePath, next);
}

function changelogEntry({ tag, date, commits }) {
  const sections = ["Added", "Changed", "Fixed"];
  const body = sections
    .map((section) => {
      const lines = commits
        .filter((commit) => commit.section === section)
        .map(
          (commit) =>
            `- ${commit.breaking ? "**BREAKING** " : ""}${
              commit.summary
            } (\`${commit.hash.slice(0, 7)}\`)`,
        );

      return lines.length ? `### ${section}\n\n${lines.join("\n")}\n` : "";
    })
    .filter(Boolean)
    .join("\n");

  return `## [${tag}] — ${date}\n\n${body}\n---\n\n`;
}

function prependChangelog(entry) {
  const changelog = readFileSync(changelogPath, "utf8");
  const anchor = /^## \[v/m.exec(changelog);
  if (!anchor) {
    throw new Error(
      "docs/changelog.md has no '## [vX.Y.Z]' entry to insert before",
    );
  }

  writeFileSync(
    changelogPath,
    changelog.slice(0, anchor.index) + entry + changelog.slice(anchor.index),
  );
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `${name}=${value}\n`);
}

// ── Decide ───────────────────────────────────────────────────────────────────
const previousTag = lastTag();
const previousVersion = previousTag ? previousTag.replace(/^v/i, "") : "0.0.0";
const currentVersion = readVersion();

const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
const commits = readCommits(range);

const result = commits.map((commit) => ({
  ...commit,
  ...classify(commit.subject, commit.body),
}));

const level = result.reduce(
  (highest, commit) => Math.max(highest, commit.level),
  0,
);
const type = LEVEL_NAMES[level];

const alreadyAhead = compareVersions(currentVersion, previousVersion) > 0;
const writes = type !== "none" && !alreadyAhead;

if (alreadyAhead) {
  console.log(
    `version-bump: package.json is already at ${currentVersion} (last tag ${
      previousTag ?? "none"
    }) — nothing to bump.`,
  );
} else if (type === "none") {
  console.log(
    `version-bump: ${commits.length} commit(s) since ${
      previousTag ?? "the first commit"
    } but none ship (docs/chore/ci/test only) — no release.`,
  );
} else {
  const next = bumpVersion(currentVersion, type);
  const tag = `v${next}`;
  const date = new Date().toISOString().slice(0, 10);
  const counted = result.filter((commit) => commit.level > 0);
  const entry = changelogEntry({ tag, date, commits: counted });

  console.log(
    `version-bump: ${type} → ${tag} (from ${commits.length} commit(s), ${counted.length} shipped)`,
  );
  if (dryRun) {
    console.log("── docs/changelog.md entry ──");
    console.log(entry.trimEnd());
  } else {
    writeVersion(next);
    prependChangelog(entry);
    console.log(
      `version-bump: wrote package.json ${next} and the ${tag} changelog entry`,
    );
  }

  setOutput("version", next);
  setOutput("tag", tag);
}

setOutput("bump", writes ? type : "none");
setOutput("previous", previousVersion);
setOutput("current", currentVersion);
