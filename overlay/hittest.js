// 커서가 클릭 영역 위에 있는지(test/hittest.test.js). 투명 창은 평소 마우스를 통과시키고, 렌더러가 알려 준 사각형
// (캐릭터·버튼·말풍선·입력창·기록 창, 창 안 좌표 [x, y, w, h]) 위에 커서가 있을 때만 마우스를 받는다.
// 예전엔 렌더러의 mouseenter(macOS 가 넘겨주는 마우스 이동)에만 기댔는데, 그 이벤트가 가끔 안 와서 캐릭터를 못 눌렀다.
// 그래서 main 이 커서 위치(화면 좌표)를 직접 보고 판정한다. 끄는 중에는 커서가 잠깐 벗어나도 계속 받는다.
function isOver(rects, cursor, bounds, dragging = false) {
  if (dragging) return true;
  const x = cursor.x - bounds.x, y = cursor.y - bounds.y;
  return (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
}

module.exports = { isOver };
