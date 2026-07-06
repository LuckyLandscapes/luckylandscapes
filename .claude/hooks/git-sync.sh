#!/usr/bin/env bash
# Auto-sync the current branch with GitHub for Claude Code.
#   SessionStart -> "pull": bring this machine up to the latest before you start.
#   Stop (end of turn) -> "sync": commit local work, rebase on remote, then push.
#
# Adapted from CrewWrench's git-sync.sh (2026-07-06 usage audit). One difference:
# this repo WORKS on main and pushing main IS the deploy (CF Pages + Vercel),
# so main is allowed here — only a detached HEAD is refused.
#
# Design goals:
#   * Self-healing: pulls --rebase BEFORE pushing, so the push is a fast-forward.
#   * Loud on failure: never swallows a conflict or a rejected push. A half-finished
#     rebase is aborted so it can't leave conflict markers for the next "git add -A".
#   * Safe: refuses to act on a detached HEAD.
set -uo pipefail

mode="${1:-sync}"

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in
  ""|"HEAD") exit 0 ;;   # never auto-sync a detached HEAD
esac

# Need a configured upstream to sync against. If there isn't one, just try to push.
if ! git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  if [ "$mode" = "sync" ]; then
    git push -q 2>&1 | tail -2 \
      || echo "git-sync: no upstream set; run 'git push -u origin $branch' once."
  fi
  exit 0
fi

# In sync mode, capture local work as a commit before integrating remote changes.
if [ "$mode" = "sync" ]; then
  git add -A
  if ! git diff --cached --quiet; then
    git commit -q -m "chore: auto-sync (end of turn)" \
      -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  fi
fi

# Integrate remote work. --autostash protects any stray unstaged changes.
if ! git pull --rebase --autostash -q 2>&1 | tail -3; then
  git rebase --abort >/dev/null 2>&1
  echo "WARNING git-sync: 'git pull --rebase' did not complete (conflict between"
  echo "        machines, or no network). Your local commits on '$branch' are intact."
  echo "        Resolve with: git pull --rebase  ->  fix conflicts  ->  git push"
  exit 0
fi

# Push local commits (sync mode). After the rebase above this is normally a fast-forward.
if [ "$mode" = "sync" ]; then
  if ! git push -q 2>&1 | tail -3; then
    echo "WARNING git-sync: 'git push' failed. Run 'git push' manually to see why."
  fi
fi
