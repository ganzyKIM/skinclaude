#!/bin/sh
# skinclaude: 마스코트(초텐·아메)가 이 대화에 대신 돌린 일(음성·⚡ 지시)의 기록을, 사용자가 이 대화에 다음 말을 칠 때 Claude 에게 건넨다.
# Claude Code 의 UserPromptSubmit 훅(~/.claude/settings.json — overlay-ctl.sh install 이 단다). 왜 필요한지는 sessionnotes.js 맨 위.
# 오버레이가 ~/.skinclaude/session-notes/<세션 id>.json 에 훅 출력(JSON)을 그대로 써 두면 여기서 한 번 내보내고 sent/ 로 옮긴다.
# 마스코트가 띄운 claude(SKINCLAUDE_CHILD=1)에는 내보내지 않는다 — 그 실행은 그 턴들을 이미 본다. 기록이 없으면 아무것도 안 한다.
[ -n "$SKINCLAUDE_CHILD" ] && exit 0
dir="$HOME/.skinclaude/session-notes"
[ -d "$dir" ] || exit 0
id=$(tr -d '\n' | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([0-9A-Za-z-]*\)".*/\1/p')
[ -n "$id" ] || exit 0
f="$dir/$id.json"
[ -f "$f" ] || exit 0
mkdir -p "$dir/sent" || exit 0
sent="$dir/sent/$id.$(date +%Y%m%d-%H%M%S).json"
mv "$f" "$sent" 2>/dev/null || exit 0
rm -f "$dir/$id.items.json"
cat "$sent"
find "$dir/sent" -name '*.json' -mtime +30 -exec rm -f {} + 2>/dev/null
exit 0
