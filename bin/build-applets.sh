#!/bin/bash
# bin/applets/*.applescript → 프로젝트 루트의 "오버레이 켜기.app"·"오버레이 끄기.app" (더블클릭·Spotlight 로 켜고 끄는 용도)
# 아이콘은 bin/skinclaude.icns 를 씌운다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for src in "$ROOT"/bin/applets/*.applescript; do
  name="$(basename "$src" .applescript)"
  osacompile -o "$ROOT/$name.app" "$src"
  cp "$ROOT/bin/skinclaude.icns" "$ROOT/$name.app/Contents/Resources/applet.icns"
  echo "made: $name.app"
done
