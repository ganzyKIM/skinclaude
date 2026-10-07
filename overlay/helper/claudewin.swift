// claudewin — Claude 데스크톱 앱 창의 화면 좌표를 200ms마다 JSON 한 줄로 stdout에 출력한다.
// CGWindowList는 창 '제목'을 읽을 때만 화면 녹화 권한이 필요하고, 위치·크기·소유자는 권한 없이 읽힌다.
// 값이 바뀔 때만 출력해 Electron 쪽 처리량을 줄인다.
import Cocoa

let claudeBundle = "com.anthropic.claudefordesktop"
var last = ""

func frontBundle() -> String {
    return NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
}

func frontOwnerByWindowList() -> String {
    let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { return "" }
    for w in list {
        guard (w[kCGWindowLayer as String] as? Int) == 0,
              let b = w[kCGWindowBounds as String] as? [String: Any],
              let width = b["Width"] as? Double, let height = b["Height"] as? Double, width >= 200, height >= 100 else { continue }
        return w[kCGWindowOwnerName as String] as? String ?? ""
    }
    return ""
}

func claudeWindow() -> [String: Any]? {
    let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { return nil }
    var best: [String: Any]? = nil
    var bestArea: Double = 0
    for w in list {
        guard (w[kCGWindowOwnerName as String] as? String) == "Claude",
              (w[kCGWindowLayer as String] as? Int) == 0,
              let b = w[kCGWindowBounds as String] as? [String: Any],
              let width = b["Width"] as? Double, let height = b["Height"] as? Double else { continue }
        // 툴팁·팝오버 같은 작은 창은 무시하고 가장 큰 창(메인 창)을 고른다
        if width < 300 || height < 200 { continue }
        let area = width * height
        if area > bestArea { bestArea = area; best = w }
    }
    return best
}

while true {
    let running = NSWorkspace.shared.runningApplications.contains { $0.bundleIdentifier == claudeBundle }
    var out: [String: Any] = ["found": false, "front": frontBundle(), "frontOwner": frontOwnerByWindowList(), "running": running]
    if let w = claudeWindow(), let b = w[kCGWindowBounds as String] as? [String: Any] {
        out["found"] = true
        out["x"] = b["X"]; out["y"] = b["Y"]; out["w"] = b["Width"]; out["h"] = b["Height"]
        out["wid"] = w[kCGWindowNumber as String]
        out["claudeFront"] = frontBundle() == claudeBundle
    }
    if let data = try? JSONSerialization.data(withJSONObject: out, options: [.sortedKeys]),
       let s = String(data: data, encoding: .utf8), s != last {
        last = s
        print(s)
        fflush(stdout)
    }
    // usleep 은 NSWorkspace 알림을 처리하지 않아 frontmostApplication 이 갱신되지 않았다. 런루프를 돌린다.
    RunLoop.main.run(until: Date().addingTimeInterval(0.2))
}
