#!/bin/bash
# queue2.txt 진행 상황: 아직 cut 이 없는 항목만 출력
cd "$(dirname "$0")"
grep -v '^#' queue2.txt | while read f c k; do
  case "$c/$k" in base/*) n="${f}_${k}";; */base) n="${f}_${c}";; */redo) n="${f}_${c}";; *) n="${f}_${c}_${k}";; esac
  [ "$c/$k" = "knit/redo" ] && { [ -f rejected/choten_knit_v1.png ] && continue; }
  [ -f "cut/$n.png" ] || echo "$f $c $k -> $n"
done
