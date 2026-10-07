#!/bin/bash
# skinclaude 오버레이 제어: install | start | stop | status | watch
#
# 왜 ~/.skinclaude 에 복사해서 쓰나: 로그인 시 상주하는 LaunchAgent(launchd)는 macOS 보호 폴더
# (Desktop·Documents·Downloads)를 읽을 수 없어 "Operation not permitted"로 죽는다. 그래서
# `install`이 소스(overlay/)를 ~/.skinclaude/app 으로 복사하고, 이 스크립트도 그 옆에 둔다.
# 소스를 고친 뒤에는 `install`을 다시 실행하면 된다.
SRC_DIR="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)"
STATE="$HOME/.skinclaude"; APP="$STATE/app"; PAUSE="$STATE/paused"
LOG="$HOME/Library/Logs/skinclaude-overlay.log"
ELECTRON="$APP/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
PLIST="$HOME/Library/LaunchAgents/com.dobedub.skinclaude.watch.plist"
LABEL="com.dobedub.skinclaude.watch"
mkdir -p "$STATE"

overlay_pid() { pgrep -f "^$ELECTRON $APP" | head -1; }
claude_running() { lsappinfo info -only pid -app com.anthropic.claudefordesktop 2>/dev/null | grep -q '"pid"='; }

do_install() {
  [ -d "$SRC_DIR/overlay" ] || { echo "source not found: $SRC_DIR/overlay" >&2; return 1; }
  echo "copying overlay → $APP"
  mkdir -p "$APP"
  rsync -a --delete --exclude .git "$SRC_DIR/overlay/" "$APP/"
  # 지시·크롬 작업은 이 프로젝트 안의 workspace 폴더에서 돈다(사용자 지시 2026-09-30). 설치본이 원본 위치를 알 수 있게 적어 둔다.
  mkdir -p "$SRC_DIR/workspace/chrome"
  printf '{"src":"%s"}\n' "$SRC_DIR" > "$APP/origin.json"
  cp "$SRC_DIR/bin/overlay-ctl.sh" "$STATE/overlay-ctl.sh"; chmod +x "$STATE/overlay-ctl.sh"
  # 마스코트가 다른 대화에 대신 돌린 일의 기록을, 그 대화를 열어 둔 화면에 남기는 훅(hooks/session-note.sh — sessionnotes.js 참고)을
  # ~/.claude/settings.json 의 UserPromptSubmit 에 단다. 이미 있으면 그대로 둔다. 떼려면 install-hook.js --remove
  ELECTRON_RUN_AS_NODE=1 "$ELECTRON" "$APP/hooks/install-hook.js" || true
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOS
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$STATE/overlay-ctl.sh</string><string>watch</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/skinclaude-watch.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/skinclaude-watch.log</string>
</dict></plist>
EOS
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  # bootstrap만 하면 launchd가 실행을 미뤄(pended nondemand spawn) 감시가 안 도는 경우가 있어 바로 띄운다
  launchctl kickstart "gui/$(id -u)/$LABEL" 2>/dev/null || true
  echo "launch agent loaded ($LABEL)"
}
do_start() {
  rm -f "$PAUSE"
  if [ -n "$(overlay_pid)" ]; then echo "already running"; return 0; fi
  [ -x "$ELECTRON" ] || { echo "not installed: run $0 install" >&2; return 1; }
  # LaunchServices(open)로 띄운다. bash 에서 바로 실행하면 macOS 가 데스크탑 폴더·마이크 권한을 Electron 이 아니라
  # 감시 스크립트(bash)의 것으로 물어서, 지시 작업이 권한 대기로 멈췄다(2026-09-30).
  # 환경 변수는 깨끗하게 넘긴다: Claude Code 세션 안에서 켜면 그 세션의 CLAUDECODE·CLAUDE_CODE_* 가 물려 들어와
  # 오버레이가 띄우는 claude 가 하위 세션으로 착각하고 시작에서 멈췄다(2026-10-01). open 은 부른 쪽 환경을 앱에 넘긴다.
  env -i HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL="${SHELL:-/bin/zsh}" TMPDIR="${TMPDIR:-/tmp/}" \
    LANG="${LANG:-ko_KR.UTF-8}" PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
    open -g -n -a "$APP/node_modules/electron/dist/Electron.app" --stdout "$LOG" --stderr "$LOG" --args "$APP"
  echo "started"
}
do_stop() {
  date +%s > "$PAUSE"
  local pid; pid="$(overlay_pid)"
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null; echo "stopped"; else echo "not running"; fi
}
do_status() {
  if [ -n "$(overlay_pid)" ]; then echo "overlay: running"; else echo "overlay: stopped"; fi
  [ -f "$PAUSE" ] && echo "paused: yes (감시가 자동으로 켜지 않음)" || echo "paused: no"
  claude_running && echo "claude: running" || echo "claude: not running"
  pgrep -fq "overlay-ctl.sh watch" && echo "watcher: running" || echo "watcher: not running"
}
do_watch() {
  while true; do
    if claude_running && [ ! -f "$PAUSE" ] && [ -z "$(overlay_pid)" ]; then
      sleep 2; do_start >/dev/null 2>&1 || true   # Claude 창이 뜰 때까지 잠깐 기다렸다 띄운다
    fi
    if ! claude_running && [ -f "$PAUSE" ]; then rm -f "$PAUSE"; fi   # 다음 Claude 실행 때 다시 자동 시작
    sleep 3
  done
}
case "${1:-status}" in
  install) do_install ;; start) do_start ;; stop) do_stop ;; status) do_status ;; watch) do_watch ;;
  *) echo "usage: $0 {install|start|stop|status|watch}" >&2; exit 2 ;;
esac
