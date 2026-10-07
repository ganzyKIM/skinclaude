// sttd — 음성 모드의 귀. 마이크 소리를 Apple 온디바이스 받아쓰기(SpeechAnalyzer + SpeechTranscriber)로 글자로 바꿔
// stdout 에 JSON 줄로 흘린다. main.js(voice 부분)가 띄우고, 호출어("쵸텐짱"·"아메짱") 판정은 main 이 한다(voice.js).
// stdin 명령(JSON 줄):
//   {"cmd":"start","locale":"ko_KR","words":["쵸텐짱",…],"ignore":["electron"],"aec":"off","endMs":1700,"fast":false}
//       듣기 시작(다른 언어로 듣고 있었으면 다시 시작). words 는 잘 알아듣게 할 이름 힌트, ignore 는 '다른 앱 소리'에서 뺄 번들 id 글자(오버레이 자신),
//       aec 는 에코 제거: "off"(main 의 기본)·"ref"(시스템 출력을 참조로 마이크에서만 뺀다 — 아래 '참조 방식 에코 제거')·
//         "auto"/"on"(macOS 음성 처리 VPIO: 다른 앱이 소리를 낼 때만/늘 — 스피커 소리가 먹먹해져서 쓰지 않는다),
//       endMs 는 말 끝 판정: 말소리 뒤 그만큼 조용하면 finalize 로 확정을 당긴다(0 이면 Apple 확정만 — 3.5~9초 늦다, main 의 기본 1700),
//       quickEndMs·quickMaxSec: 이어 듣기 창 밖에서 말소리가 quickMaxSec 이하인 짧은 말(이름만 부른 것)은 quickEndMs 만 기다린다(main 의 기본 600·1.3),
//       fast 는 .fastResults(정확도 대신 속도)
//   {"cmd":"pause"} / {"cmd":"resume"} 마스코트가 말하는 동안은 듣지 않는다(반이중)
//   {"cmd":"flush"}                     지금까지 들은 소리를 바로 확정으로 받는다(시험·수동용)
//   {"cmd":"awake","until":epochMs}     이어 듣기 창(유예 포함)이 언제까지 열려 있는지. 그 안에서는 짧은 말도 endMs 만큼 기다린다
//   {"cmd":"duck","db":10} / {"cmd":"unduck"}  맥 출력 음량을 db 만큼 낮췄다가 되돌린다(캐릭터가 말하는 동안 다른 소리를 줄이려고).
//       → {"type":"ducked","db":실제로 낮춘 양}. 캐릭터 목소리는 main 이 그만큼 키워 튼다. 사용자가 그새 음량을 바꿨으면 되돌리지 않는다.
//   {"cmd":"stop"}                      끄기
//   {"cmd":"file","path":"…","locale":"ja_JP","words":[…]}  파일 받아쓰기(마이크 없이 시험할 때)
// stdout: {"type":"ready","locale"} {"type":"partial","text"} {"type":"final","text","sinceSpeechMs","forced","quick","peakRms","noiseFloor","aec","echo","band"}
//         {"type":"error","message"} {"type":"done"} {"type":"info","message"} {"type":"speech","rms","aec"}
//         {"type":"echo","on":bool}  참조 방식 에코 제거가 켜졌는지(켜져 있으면 final·speech 의 크기는 말소리 대역 300~3400Hz 의 것이다 — "band":true)
//         {"type":"media","playing":bool,"who":[번들 id…]}  다른 앱이 스피커로 소리를 내기 시작/멈춤(start 의 "ignore" 글자가 든 번들은 뺀다)
// 시험: sttd --aec-test mic.wav ref.wav out.wav [refs.wav]  (참조 방식 에코 제거와 말 시작·끝 판정을 파일로 돌려 본다. 모두 16kHz 모노 16비트)
// 빌드: swiftc -O helper/sttd.swift -o helper/sttd  (npm run build:sttd)
import Foundation
import Accelerate
import AVFoundation
import CoreAudio
import CoreMedia
import Speech

// 16kHz 모노 16비트 WAV 로 쓴다(진단 덤프·시험 모드)
func writeWav16(_ path: String, _ a: [Float]) {
  var d = Data()
  func u32(_ v: Int) { var x = UInt32(v); d.append(Data(bytes: &x, count: 4)) }
  func u16(_ v: Int) { var x = UInt16(v); d.append(Data(bytes: &x, count: 2)) }
  d.append("RIFF".data(using: .ascii)!); u32(36 + a.count * 2); d.append("WAVEfmt ".data(using: .ascii)!); u32(16); u16(1); u16(1); u32(16000); u32(32000); u16(2); u16(16)
  d.append("data".data(using: .ascii)!); u32(a.count * 2)
  for v in a { var x = Int16(max(-1, min(1, v)) * 32767); d.append(Data(bytes: &x, count: 2)) }
  try? d.write(to: URL(fileURLWithPath: path))
}
let emitLock = NSLock() // 오디오 스레드·타이머·결과 Task 가 같이 쓴다: 긴 줄(발음 토큰)이 서로 섞이면 main 이 그 줄을 버린다
func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj), let line = String(data: data, encoding: .utf8) else { return }
  emitLock.lock(); defer { emitLock.unlock() }
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}
func fail(_ message: String) { emit(["type": "error", "message": message]) }

// 다른 앱(크롬 노래·영상 등)이 스피커로 소리를 내는지 0.5초마다 본다. 그 소리가 마이크로 들어와 요청으로 잘못 받히는 걸
// main 이 막는다(2026-10-01 사용자: "영상 재생하고 있는 소리가 에이전트에 들어가서 혼란을 준다").
// Core Audio 프로세스 객체(macOS 14.2+)의 IsRunningOutput 을 읽는다. 권한은 필요 없다(시험 확인). 크롬은 멈추면 곧 false 가 된다.
final class OutputWatch {
  private var timer: DispatchSourceTimer?
  private var last: Bool? = nil
  private var offCount = 0
  private var ignore: [String] = []
  var onChange: ((Bool) -> Void)?   // 소리가 이어지거나 한동안 조용해졌을 때(위 주석)
  var onImmediate: ((Bool) -> Void)? // 바뀌는 즉시
  private var steady = false, run = 0

  private static func propU32(_ obj: AudioObjectID, _ sel: AudioObjectPropertySelector) -> UInt32 {
    var addr = AudioObjectPropertyAddress(mSelector: sel, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size = UInt32(MemoryLayout<UInt32>.size); var v: UInt32 = 0
    return AudioObjectGetPropertyData(obj, &addr, 0, nil, &size, &v) == noErr ? v : 0
  }
  private static func bundle(_ obj: AudioObjectID) -> String {
    var addr = AudioObjectPropertyAddress(mSelector: kAudioProcessPropertyBundleID, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size); var s: Unmanaged<CFString>? = nil
    guard AudioObjectGetPropertyData(obj, &addr, 0, nil, &size, &s) == noErr, let str = s?.takeRetainedValue() else { return "" }
    return str as String
  }
  // 지금 소리를 내는 다른 프로세스들의 번들 id(없으면 "pid N")
  private func playing() -> [String] {
    var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyProcessObjectList, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    let sys = AudioObjectID(kAudioObjectSystemObject)
    guard AudioObjectGetPropertyDataSize(sys, &addr, 0, nil, &size) == noErr, size > 0 else { return [] }
    var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
    guard AudioObjectGetPropertyData(sys, &addr, 0, nil, &size, &ids) == noErr else { return [] }
    let me = UInt32(getpid()) // 에코 제거(VPIO)를 켜면 이 헬퍼 자신도 출력 스트림을 연다 — 남의 소리가 아니다
    return ids.filter { OutputWatch.propU32($0, kAudioProcessPropertyIsRunningOutput) != 0 && OutputWatch.propU32($0, kAudioProcessPropertyPID) != me }
      .map { let b = OutputWatch.bundle($0); return b.isEmpty ? "pid \(OutputWatch.propU32($0, kAudioProcessPropertyPID))" : b }
      .filter { name in !ignore.contains { !$0.isEmpty && name.lowercased().contains($0.lowercased()) } }
  }
  func start(ignore: [String]) {
    stop()
    self.ignore = ignore
    let t = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
    t.schedule(deadline: .now(), repeating: .milliseconds(500))
    t.setEventHandler { [weak self] in
      guard let self else { return }
      let who = self.playing()
      // 곡 사이 잠깐 끊겨도 흔들리지 않게, 멈춤은 1초(두 번 연속) 이어져야 알린다
      if who.isEmpty { self.offCount += 1; if self.last == true && self.offCount < 2 { return } } else { self.offCount = 0 }
      let now = !who.isEmpty
      if now != self.last { self.last = now; emit(["type": "media", "playing": now, "who": who]); self.onImmediate?(now) }
      // 에코 제거 전환용: 알림음 같은 짧은 소리에 마이크 엔진을 껐다 켜지 않게, 1.5초 넘게 이어질 때 켜고 3초 넘게 조용할 때 끈다
      if now == self.steady { self.run = 0 } else {
        self.run += 1
        if self.run >= (now ? 3 : 6) { self.steady = now; self.run = 0; self.onChange?(now) }
      }
    }
    t.resume()
    timer = t
  }
  func stop() { timer?.cancel(); timer = nil; last = nil; offCount = 0; steady = false; run = 0 }
}

// ── 참조 방식 에코 제거 ──────────────────────────────────────────────────────────────────────────────────────────
// 노래·영상이 나오는 중에는 그 소리가 마이크로 같이 들어와 이름과 부탁이 뭉개진다(2026-10-01 실사용: 노래 중 호출의 절반 넘게 놓쳤다).
// macOS 의 음성 처리(VPIO)로 지우면 스피커 소리 전체가 통화용으로 바뀌어 노래가 먹먹해진다고 해서(사용자) 쓰지 않는다.
// 여기서는 스피커 소리는 건드리지 않고, 시스템 출력(스피커로 나가는 모든 앱의 소리)을 그대로 받아 와(RefTap) 그걸 참조 삼아 마이크 소리에서만 뺀다.
// start 의 "aec":"ref" 일 때만 켠다. 처음 켤 때 macOS 가 "시스템 오디오 녹음" 허용을 한 번 묻는다.

// 스피커로 나간 소리(참조)를 알고 있을 때, 마이크에 섞여 들어온 그 소리(에코)를 빼는 적응 필터. 16kHz.
// 참조는 두 채널이다: 가운데 M=(L+R)/2 와 옆 S=(L−R)/2. 노래는 좌우 소리가 다르고 두 스피커에서 마이크까지의 길도 달라서,
// 한 채널로 합친 참조로는 7~9dB 밖에 못 지웠다(2026-10-02 실측. 좌우가 같은 캐릭터 목소리는 26dB). 채널마다 필터를 따로 둔다.
// 구조는 Speex 의 MDF 와 같다(Valin 2007): 16ms(N=256) 블록마다 배우고, 필터는 조각 M개(64ms)를 주파수 영역에서 이어 쓴다.
//  - 블록이 64ms 하나였을 때는 새 소리에 맞춰지는 게 느렸다(처음 10dB 까지 4초, 음량이 바뀐 뒤 2초 넘게). 16ms 로 나누니 두 배쯤 빨라졌다.
//  - 필터를 두 벌 돌린다(two-path): 늘 배우는 쪽(background)과 출력에 쓰는 쪽(foreground). 배우는 쪽이 통계적으로 뚜렷이 나을 때만
//    출력 쪽에 베끼고, 뚜렷이 나빠지면 출력 쪽 것으로 되돌린다.
//  - 걸음(학습률)은 주파수마다 "남은 에코 / 지금 잔여"로 정한다: 사람이 말하는 동안(겹말)은 잔여가 남은 에코보다 훨씬 크니 걸음이 저절로
//    작아져 필터가 흐트러지지 않는다. 걸음이 고정(0.3)이었을 때는 말하는 동안과 그 직후 1~2초에 노래가 3~4dB 더 새서, 말이 끝났는지
//    가릴 수 없었다(2026-10-02 실측, 말소리 대역: 말 뒤 남은 소리의 봉우리 0.0068 → 고친 뒤 0.0049. 말이 없을 때는 0.0045).
//    남은 에코의 비율(leak)은 잔여와 에코 추정의 세기 스펙트럼이 같이 오르내리는 정도로 잰다.
//  - 안에서는 고역을 강조한 소리(s[n] − 0.9·s[n−1])로 계산하고 출력에서 되돌린다: 에너지로 하는 판단이 저음(방의 웅웅거림·베이스)에
//    끌려가지 않고 말소리 대역을 보게 된다.
final class EchoCanceller {
  static let N = 256, C = 2, M = 4      // 블록 16ms · 참조 채널 2 · 필터 조각 4개(64ms)
  private let N = EchoCanceller.N, F = EchoCanceller.N * 2, C = EchoCanceller.C, M = EchoCanceller.M
  private let fwd: vDSP_DFT_Setup, inv: vDSP_DFT_Setup
  private var wfR: [[Float]], wfI: [[Float]], wbR: [[Float]], wbI: [[Float]]   // 필터(주파수 영역) [채널·조각][주파수]: 출력 쪽(f)·배우는 쪽(b)
  private var XR: [[Float]], XI: [[Float]]                                     // 참조의 변환 [채널·(조각+1)][주파수] — 0 이 지금 블록
  private var P: [[Float]]                                                     // 참조의 주파수별 세기(평활) [채널][주파수]
  private var xPrev: [[Float]], prop: [Float]                                  // 앞 블록의 참조 · 조각별 걸음 몫
  private var Eh: [Float], Yh: [Float], Rf: [Float], Yf: [Float], step: [Float]
  private var pey: Float = 1e-9, pyy: Float = 1e-9
  private(set) var leak: Float = 0                                             // 남은 에코가 에코 추정의 몇 배(세기)쯤인지
  private var adapted = false                                                  // 처음 배우는 단계(고정 걸음)를 지났는지
  private(set) var active = 0                                                  // 비운 뒤로 참조에 소리가 있던 블록 수(얼마나 배웠는지)
  private var sumAdapt: Float = 0
  private var davg1: Float = 0, davg2: Float = 0, dvar1: Float = 0, dvar2: Float = 0
  private var sff: Float = 0, sdd: Float = 0                                   // 평활한 에너지(원래 소리 기준): 출력 잔여·마이크
  private var harmful = 0, count = 0
  // delta: 참조가 약한 주파수에서는 덜 배우게 하는 값. 키우면(2.5e-3) 노래만 있을 때 1~2dB 더 지우지만 겹말에서 3dB 나빠졌다(2026-10-02)
  private let pre: Float = 0.9, delta: Float = 2.5e-4
  private let gam: Float, rise: Float
  private var dPrev: Float = 0, xLast: [Float], oPrev: Float = 0               // 고역 강조·되돌리기의 앞 표본
  private var x2: [Float], zero: [Float], tR: [Float], tI: [Float], uR: [Float], uI: [Float], eR: [Float], eI: [Float]
  private var dp: [Float], ff: [Float], eb: [Float], e2: [Float]

  init() {
    fwd = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(F), .FORWARD)!
    inv = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(F), .INVERSE)!
    let z = [Float](repeating: 0, count: F), h = [Float](repeating: 0, count: N)
    let zz = [[Float]](repeating: z, count: C * M), zx = [[Float]](repeating: z, count: C * (M + 1))
    wfR = zz; wfI = zz; wbR = zz; wbI = zz; XR = zx; XI = zx
    P = [[Float]](repeating: z, count: C)
    x2 = z; zero = z; tR = z; tI = z; uR = z; uI = z; eR = z; eI = z; e2 = z
    Eh = [Float](repeating: 0, count: N + 1); Yh = Eh; Rf = Eh; Yf = Eh; step = Eh
    dp = h; ff = h; eb = h; xPrev = [[Float]](repeating: h, count: C); xLast = [Float](repeating: 0, count: C)
    prop = [Float](repeating: 0, count: M)
    let per = Float(N) / 1024             // 64ms 블록 기준으로 잡았던 값들을 블록 길이에 맞춘다
    gam = pow(0.6, per); rise = pow(1.015, per)
    resetProp()
  }
  deinit { vDSP_DFT_DestroySetup(fwd); vDSP_DFT_DestroySetup(inv) }
  // 조각별 걸음 몫: 처음엔 앞 조각(스피커에서 바로 온 소리)에 많이 준다(앞뒤 비 10쯤)
  private func resetProp() {
    let decay = exp(-2.4 / Float(M))
    var v: Float = 0.7, sum: Float = 0
    for i in 0..<M { prop[i] = v; sum += v; v *= decay }
    for i in 0..<M { prop[i] = 0.8 * prop[i] / sum }
  }

  func reset() {
    for i in 0..<(C * M) { for k in 0..<F { wfR[i][k] = 0; wfI[i][k] = 0; wbR[i][k] = 0; wbI[i][k] = 0 } }
    for i in 0..<(C * (M + 1)) { for k in 0..<F { XR[i][k] = 0; XI[i][k] = 0 } }
    for c in 0..<C { for k in 0..<F { P[c][k] = 0 }; for i in 0..<N { xPrev[c][i] = 0 }; xLast[c] = 0 }
    for k in 0...N { Eh[k] = 0; Yh[k] = 0; step[k] = 0 }
    for k in 0..<F { eR[k] = 0; eI[k] = 0 }
    pey = 1e-9; pyy = 1e-9; leak = 0; adapted = false; sumAdapt = 0; davg1 = 0; davg2 = 0; dvar1 = 0; dvar2 = 0
    sff = 0; sdd = 0; harmful = 0; dPrev = 0; oPrev = 0; count = 0; active = 0
    resetProp()
  }
  // 참조 흐름이 끊겼다(쉬었다 옴): 필터는 두고 이어 붙이던 앞 소리만 버린다
  func breakStream() {
    for c in 0..<C { for i in 0..<N { xPrev[c][i] = 0 }; xLast[c] = 0 }
    for i in 0..<(C * (M + 1)) { for k in 0..<F { XR[i][k] = 0; XI[i][k] = 0 } }
    for k in 0..<F { eR[k] = 0; eI[k] = 0 }
  }
  // 지금 에코를 얼마나 지우고 있나(dB, 사람이 말하지 않을 때의 값이 뜻이 있다)
  var erleDb: Float { sff > 1e-12 && sdd > 1e-12 ? 10 * log10(sdd / sff) : 0 }

  // e = d − (Σ W·X 를 시간으로 되돌린 것의 뒤 N개). Σe² 를 돌려준다
  private func residual(_ wR: [[Float]], _ wI: [[Float]], _ d: [Float], _ e: inout [Float]) -> Float {
    for k in 0..<F { tR[k] = 0; tI[k] = 0 }
    for c in 0..<C { for j in 0..<M {
      let i = c * M + j, h = c * (M + 1) + j
      wR[i].withUnsafeBufferPointer { wr in wI[i].withUnsafeBufferPointer { wi in XR[h].withUnsafeBufferPointer { xr in XI[h].withUnsafeBufferPointer { xi in
        for k in 0..<F { tR[k] += wr[k] * xr[k] - wi[k] * xi[k]; tI[k] += wr[k] * xi[k] + wi[k] * xr[k] }
      } } } }
    } }
    vDSP_DFT_Execute(inv, tR, tI, &uR, &uI)
    let s = 1 / Float(F)
    var sum: Float = 0
    for n in 0..<N { let v = d[n] - uR[N + n] * s; e[n] = v; sum += v * v }
    return sum
  }

  // 한 블록(16ms): d = 마이크 N개, x = 같은 때의 참조(채널마다 N개) → out = 에코를 뺀 N개
  func block(_ d: UnsafePointer<Float>, _ x: [UnsafePointer<Float>], _ out: UnsafeMutablePointer<Float>) {
    count += 1
    var sxx: Float = 0, rawD: Float = 0
    for c in 0..<C {
      // 조각 기록을 한 칸씩 민다(가장 오래된 자리를 지금 블록으로 다시 쓴다)
      let base = c * (M + 1)
      let lastR = XR[base + M], lastI = XI[base + M]
      for j in stride(from: M, to: 0, by: -1) { XR[base + j] = XR[base + j - 1]; XI[base + j] = XI[base + j - 1] }
      XR[base] = lastR; XI[base] = lastI
      var last = xLast[c]
      for n in 0..<N { let v = x[c][n]; let p = v - pre * last; last = v; x2[n] = xPrev[c][n]; x2[N + n] = p; xPrev[c][n] = p; sxx += p * p }
      xLast[c] = last
      vDSP_DFT_Execute(fwd, x2, zero, &XR[base], &XI[base])
    }
    for n in 0..<N { let v = d[n]; dp[n] = v - pre * dPrev; dPrev = v; rawD += v * v }
    if sxx > Float(N) * 1e-6 { active += 1 }
    let sf = residual(wfR, wfI, dp, &ff)          // 출력 쪽 잔여
    // 배우는 쪽 갱신(앞 블록의 잔여 E 와 걸음으로): W += 몫·걸음·conj(X)·E / P
    if count > 1 {
      let s = 1 / Float(F)
      for c in 0..<C {
        let base = c * M, hist = c * (M + 1) + 1  // 앞 블록 때의 조각 j 는 지금 기록의 j+1
        for j in 0..<M {
          let pj = prop[j], xr = XR[hist + j], xi = XI[hist + j], pw = P[c]
          wbR[base + j].withUnsafeMutableBufferPointer { wr in wbI[base + j].withUnsafeMutableBufferPointer { wi in
            for k in 0..<F {
              let g = pj * step[k <= N ? k : F - k] / (pw[k] + delta)
              wr[k] += g * (xr[k] * eR[k] + xi[k] * eI[k])
              wi[k] += g * (xr[k] * eI[k] - xi[k] * eR[k])
            }
          } }
        }
        // 필터 조각의 길이를 N 으로 묶는다(시간 영역에서 뒤 절반을 지운다): 첫 조각은 매번, 나머지는 돌아가며 하나씩
        for j in 0..<M where j == 0 || M == 1 || (count % (M - 1)) == j - 1 {
          vDSP_DFT_Execute(inv, wbR[base + j], wbI[base + j], &uR, &uI)
          for n in 0..<N { uR[n] *= s; uI[n] *= s }
          for n in N..<F { uR[n] = 0; uI[n] = 0 }
          vDSP_DFT_Execute(fwd, uR, uI, &wbR[base + j], &wbI[base + j])
        }
      }
    }
    var se = residual(wbR, wbI, dp, &eb)          // 배우는 쪽 잔여
    var dbf: Float = 1e-9
    for n in 0..<N { let v = ff[n] - eb[n]; dbf += v * v }
    // 어느 쪽을 쓸지: 배우는 쪽이 통계적으로 뚜렷이 나을 때만 출력 쪽에 베낀다(겹말로 잠깐 나아 보이는 건 넘어가지 않는다).
    // 반대로 뚜렷이 나빠졌으면 배우는 쪽을 출력 쪽 것으로 되돌린다
    let diff = sf - se
    davg1 = 0.6 * davg1 + 0.4 * diff; davg2 = 0.85 * davg2 + 0.15 * diff
    dvar1 = 0.36 * dvar1 + 0.16 * sf * dbf; dvar2 = 0.7225 * dvar2 + 0.0225 * sf * dbf
    var adopt = false
    if diff * abs(diff) > sf * dbf || davg1 * abs(davg1) > 0.5 * dvar1 || davg2 * abs(davg2) > 0.25 * dvar2 {
      adopt = true; wfR = wbR; wfI = wbI
      davg1 = 0; davg2 = 0; dvar1 = 0; dvar2 = 0
    } else if -(diff * abs(diff)) > 4 * sf * dbf || -(davg1 * abs(davg1)) > 4 * dvar1 || -(davg2 * abs(davg2)) > 4 * dvar2 {
      wbR = wfR; wbI = wfI; eb = ff; se = sf
      davg1 = 0; davg2 = 0; dvar1 = 0; dvar2 = 0
    }
    // 출력(고역 강조를 되돌린다). 이번 블록에 베꼈으면 앞에서 뒤로 넘어가며 섞는다(이음매가 튀지 않게)
    var rawO: Float = 0
    for n in 0..<N {
      var v = ff[n]
      if adopt { let w = Float(n) / Float(N); v = (1 - w) * ff[n] + w * eb[n] }
      let o = v + pre * oPrev; oPrev = o; out[n] = o; rawO += o * o
    }
    sdd = gam * sdd + (1 - gam) * rawD; sff = gam * sff + (1 - gam) * rawO
    if sff > 1.2 * sdd && sdd > 1e-10 { harmful += 1 } else { harmful = 0 }
    if harmful >= 6 * 1024 / N { reset(); return }                // 출력 쪽이 오히려 소리를 보탠다(길이 크게 바뀜) → 처음부터 다시 배운다
    // 다음 갱신에 쓸 것: 잔여 E 와 에코 추정 Y 의 스펙트럼
    var syy: Float = 0, sey: Float = 0
    for n in 0..<N { let y = dp[n] - eb[n]; e2[n] = 0; e2[N + n] = y; syy += y * y; sey += eb[n] * y }
    vDSP_DFT_Execute(fwd, e2, zero, &tR, &tI)
    for k in 0...N { Yf[k] = tR[k] * tR[k] + tI[k] * tI[k] }
    for n in 0..<N { e2[N + n] = eb[n] }
    vDSP_DFT_Execute(fwd, e2, zero, &eR, &eI)
    for k in 0...N { Rf[k] = eR[k] * eR[k] + eI[k] * eI[k] }
    // 참조의 세기(채널마다 평활)
    let ss = 0.35 / Float(M)
    for c in 0..<C {
      let xr = XR[c * (M + 1)], xi = XI[c * (M + 1)]
      P[c].withUnsafeMutableBufferPointer { p in for k in 0..<F { p[k] += ss * (xr[k] * xr[k] + xi[k] * xi[k] - p[k]) } }
    }
    // 남은 에코의 비율(leak)
    let sa = Float(N) / Float(RefEcho.SR)
    var peyN: Float = 1e-12, pyyN: Float = 1e-12
    for k in 0...N {
      let ec = Rf[k] - Eh[k], yc = Yf[k] - Yh[k]
      peyN += ec * yc; pyyN += yc * yc
      Eh[k] += sa * (Rf[k] - Eh[k]); Yh[k] += sa * (Yf[k] - Yh[k])
    }
    pyyN = pyyN.squareRoot(); peyN /= pyyN
    let alpha = se > 1e-12 ? min(2 * sa * syy, 0.5 * sa * se) / se : 0
    pey += alpha * (peyN - pey); pyy += alpha * (pyyN - pyy)
    if pyy < 1e-9 { pyy = 1e-9 }
    pey = max(0.005 * pyy, min(pyy, pey))
    let lk = pey / pyy
    // 오르는 건 천천히(초당 2dB): 사람 말·딸깍 소리가 들어오면 이 값이 부풀어 걸음이 커지고, 그러면 겹말에서 필터가 흐트러진다
    if leak > 0 && lk > leak * rise { leak *= rise; pey = leak * pyy } else { leak = lk }
    var rer = se > 1e-12 ? (0.0001 * sxx + 3 * leak * syy) / se : 0
    let low = sey * sey / (1e-12 + se * syy)                      // 잔여가 에코 추정과 닮았으면(길이 바뀜) 남은 에코가 그만큼은 있다
    if rer < low { rer = low }
    if rer > 0.5 { rer = 0.5 }
    if !adapted && sumAdapt > Float(M) && leak > 0.03 { adapted = true }
    if adapted {
      for k in 0...N {
        let e = Rf[k] + 1e-12
        var r = leak * Yf[k]
        if r > 0.5 * e { r = 0.5 * e }
        step[k] = (0.7 * r + 0.3 * rer * e) / e
      }
      // 조각별 걸음 몫: 필터 에너지가 많은 조각에 더 준다
      var mx: Float = 1e-9, sum: Float = 1e-9
      for j in 0..<M {
        var t: Float = 1e-12
        for c in 0..<C { let wr = wbR[c * M + j], wi = wbI[c * M + j]; for k in 0..<F { t += wr[k] * wr[k] + wi[k] * wi[k] } }
        prop[j] = t.squareRoot(); if prop[j] > mx { mx = prop[j] }
      }
      for j in 0..<M { prop[j] += 0.1 * mx; sum += prop[j] }
      for j in 0..<M { prop[j] = 0.99 * prop[j] / sum }
    } else {
      // 아직 배운 게 없다: 참조에 소리가 있을 때만 고정 걸음(최대 0.25)으로 배운다
      var rate: Float = 0
      if sxx > Float(N) * 1e-6 && se > 1e-12 { rate = 0.25 * min(sxx, se) / se }
      for k in 0...N { step[k] = rate }
      sumAdapt += rate
    }
  }
}

// 참조 흐름과 마이크 흐름의 자리를 맞춰 EchoCanceller 에 넣는다. 스피커→마이크 지연(출력 지연 + 공기 + 입력 지연)은
// 두 흐름의 상관(GCC-PHAT)으로 찾아 참조를 그만큼 늦춰 읽는다 — 필터(64ms) 안에 에코가 들어오게.
final class RefEcho {
  static let SR = 16000.0
  private let N = EchoCanceller.N, C = EchoCanceller.C
  private let aec = EchoCanceller()
  private let lock = NSLock()
  // 참조 고리 버퍼(채널마다 — 가운데·옆)
  private let cap = 16000 * 12
  private var ring: [[Float]]
  private var total = 0                 // 지금까지 쓴 표본 수(= 다음에 쓸 자리)
  // 참조의 '시각 → 자리' 관계: 자리 = (시각 − t0)·SR + refOff.
  // 장치의 실제 표본 속도는 명목과 조금 다르다(이 맥은 −2.8ppm). 처음 한 번 잡은 기준으로 계속 환산했더니 22초마다 한 표본씩 어긋났고,
  // 그걸 따라가느라 참조를 한 표본 옮길 때마다 1~3초씩 말소리 대역이 통째로 새었다(2026-10-02 실측: 마이크와 스피커는 같은 시계라
  // 옮길 일이 아예 없었다). 그래서 최근 콜백들로 이 관계를 천천히 따라가고, 마이크 쪽은 센 표본 수로만 이어 읽는다.
  private var refKnown = false, t0 = 0.0, refOff = 0.0
  // 마이크 쪽: 마이크 표본 i 와 같은 때의 참조 자리 = i + dLock (지연 0 일 때)
  private var micCount = 0, locked = false, dLock = 0, dEst = 0.0, lockAge = 0
  private var pending: [(mic: [Float], ref0: Int?, t: Double)] = []   // 참조가 아직 안 온 덩이
  private var micFifo: [Float] = [], refFifo: [[Float]]
  private(set) var delay = 0            // 참조를 늦춰 읽는 양(표본)
  private var delayKnown = false
  // 지연 찾기용 기록(마이크 원본 + 그 첫 표본의 참조 자리(지연 0))
  private let W = 32768
  private var hist: [Float] = [], histRef0: Int? = nil
  private var sinceEstimate = 0, stuck = 0, candidate: Int? = nil
  private var refEnergy: Float = 0, refNow: Float = 0   // 최근 참조 크기(평활)·바로 앞 블록의 참조 크기(평균 제곱)
  private let fwdW: vDSP_DFT_Setup, invW: vDSP_DFT_Setup
  var onInfo: ((String) -> Void)?
  // 진단: 흐름이 얼마나 끊기고 어긋났는지, 지연 찾기가 어땠는지(상태 줄에 싣는다)
  private(set) var gapFills = 0, gapSamples = 0, reanchors = 0, jumps = 0, slips = 0, estimates = 0, lastLag = 0
  private(set) var lastPeakRatio: Float = 0
  // 진단 덤프: 필터에 실제로 들어간 마이크·참조 블록과 나온 블록, 그리고 두 흐름의 덩이별 시각을 잠깐 모은다(startDump)
  private var dumpLeft = 0, dumpMic: [Float] = [], dumpRef: [[Float]], dumpOut: [Float] = []
  private var dumpMicLog: [[Double]] = [], dumpRefLog: [[Double]] = []
  var onDump: (([Float], [[Float]], [Float], [[Double]], [[Double]]) -> Void)?
  func startDump(seconds: Double) {
    lock.lock(); defer { lock.unlock() }
    dumpMic = []; dumpRef = [[Float]](repeating: [], count: C); dumpOut = []; dumpMicLog = []; dumpRefLog = []
    dumpLeft = max(1, Int(seconds * RefEcho.SR / Double(N)))
  }

  init() {
    ring = [[Float]](repeating: [Float](repeating: 0, count: cap), count: C)
    refFifo = [[Float]](repeating: [], count: C); dumpRef = refFifo
    fwdW = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(W), .FORWARD)!
    invW = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(W), .INVERSE)!
  }
  deinit { vDSP_DFT_DestroySetup(fwdW); vDSP_DFT_DestroySetup(invW) }

  var erleDb: Float { aec.erleDb }
  var leak: Float { aec.leak }
  var delayMs: Double { Double(delay) / RefEcho.SR * 1000 }
  var refLevel: Float { refEnergy.squareRoot() }   // 최근 참조 소리 크기(RMS, 가운데 채널)
  // 지금 스피커에서 소리가 나는데 필터가 아직 처음 배우는 중(막 켰거나 지연을 다시 맞춘 뒤로 소리가 2초도 안 났다): 남은 소리를 말로 보면 안 된다.
  // '지금'은 바로 앞 블록(16ms)으로 본다. 평활한 크기로 봤더니 띠링·또롱이 끝난 뒤에도 2초쯤 '배우는 중'이 이어져, 그 사이에 시작한 대답이
  // 말로 잡히지 않고 버려졌다(2026-10-02 14:18 실사용: 또롱으로 지연을 맞추며 필터를 비운 직후의 이어 말)
  var cold: Bool { aec.active < Int(2 * RefEcho.SR) / N && refNow > 1e-6 }

  // 참조(시스템 출력) 표본을 넣는다(채널마다 n개). t = 첫 표본의 시각(초)
  func pushRef(_ s: [UnsafePointer<Float>], count n: Int, at t: Double) {
    lock.lock(); defer { lock.unlock() }
    if !refKnown { refKnown = true; t0 = t; refOff = Double(total) }
    let expect = (t - t0) * RefEcho.SR + refOff
    if dumpLeft > 0 && dumpRefLog.count < 4000 { dumpRefLog.append([t, Double(n), Double(total), expect]) }
    let dev = Double(total) - expect
    if dev < -48 {              // 장치가 쉬었다(표본이 시간보다 적다): 빈 구간을 0 으로 채워 자리와 시각을 맞춘다
      let fill = Int((-dev).rounded())
      gapFills += 1; gapSamples += fill
      if fill > cap { for c in 0..<C { for i in 0..<cap { ring[c][i] = 0 } }; total += fill }
      else { for _ in 0..<fill { for c in 0..<C { ring[c][total % cap] = 0 }; total += 1 } }
    } else if dev > 48 {        // 표본이 더 많이 왔다: 관계를 지금으로 옮긴다
      reanchors += 1; refOff += dev
    } else { refOff += 0.02 * dev } // 천천히 따라간다(콜백 시각은 ±0.5표본쯤 흔들린다)
    for c in 0..<C { let p = s[min(c, s.count - 1)]; for i in 0..<n { ring[c][(total + i) % cap] = c < s.count ? p[i] : 0 } }
    total += n
  }
  // 고리 버퍼(채널 c)에서 [from, from+n) 을 읽는다(없는 자리는 0). lock 을 잡은 채 부른다
  private func readRef(_ c: Int, _ from: Int, _ n: Int, into out: inout [Float]) {
    for i in 0..<n {
      let idx = from + i
      out.append(idx >= 0 && idx < total && idx >= total - cap ? ring[c][idx % cap] : 0)
    }
  }

  // 마이크 표본(16kHz)을 넣으면 에코를 뺀 표본(clean)과 그때 뺀 소리(echo = 에코 추정)가 블록 단위로 나온다(처음엔 비어 있을 수 있다).
  // t = 첫 표본의 시각(초)
  func process(_ mic: [Float], at t: Double) -> (clean: [Float], echo: [Float]) {
    lock.lock()
    var zeroRef: Int? = nil, ref0: Int? = nil                    // 이 덩이 첫 표본의 참조 자리: 지연 0 일 때 · 지연을 뺀 것
    if refKnown {
      let z = (t - t0) * RefEcho.SR + refOff - Double(micCount)
      if !locked || abs(z - Double(dLock)) > 48 {                 // 처음이거나 쉬었다 왔다(마이크를 다시 엶·장치 바뀜): 그 자리로 건너뛴다
        if locked { jumps += 1; aec.breakStream() }
        locked = true; dLock = Int(z.rounded()); dEst = z; lockAge = 0
      } else {
        // 이어지는 덩이는 센 자리 그대로 읽는다. 두 장치의 시계가 정말 다르면(다른 장치의 마이크) 어긋남이 한 표본을 넘을 때마다 한 표본씩
        // 따라간다 — 그때마다 1~3초는 덜 지워진다(같은 시계면 일어나지 않는다).
        // 맞춘 직후 3초는 어림값이 자리를 잡는 중이라 가장 가까운 정수를 따라간다(필터도 아직 배우는 중이다). 첫 덩이의 값으로 바로 묶었더니
        // 어긋남이 −0.98 에 걸쳐 있어 조금만 흔들려도 옮겨질 판이었다(2026-10-02 실측)
        dEst += 0.1 * (z - dEst); lockAge += 1
        let off = dEst - Double(dLock)
        if lockAge <= 30 { if abs(off) > 0.5 { dLock = Int(dEst.rounded()) } }
        else if abs(off) > 1 { dLock += off > 0 ? 1 : -1; slips += 1 }
      }
      zeroRef = micCount + dLock; ref0 = zeroRef! - delay
    } else { locked = false }
    micCount += mic.count
    // 지연 찾기용 기록
    if let z = zeroRef {
      if let h0 = histRef0, abs((h0 + hist.count) - z) <= 1 { hist.append(contentsOf: mic) } else { hist = mic; histRef0 = z }
      if hist.count > W { let drop = hist.count - W; hist.removeFirst(drop); histRef0! += drop }
    }
    if dumpLeft > 0 && dumpMicLog.count < 2000 { dumpMicLog.append([t, Double(mic.count), Double(zeroRef ?? -1), Double(ref0 ?? -1), Double(total), dEst - Double(dLock)]) }
    pending.append((mic, ref0, t))
    // 참조가 다 온 덩이부터 꺼낸다. 0.25초 넘게 안 오면(탭이 멈춤) 없는 만큼 0 으로 두고 넘긴다
    while let p = pending.first {
      let ready = p.ref0 == nil || p.ref0! + p.mic.count <= total || t - p.t > 0.25
      if !ready { break }
      pending.removeFirst()
      micFifo.append(contentsOf: p.mic)
      for c in 0..<C {
        if let r0 = p.ref0 { readRef(c, r0, p.mic.count, into: &refFifo[c]) } else { refFifo[c].append(contentsOf: [Float](repeating: 0, count: p.mic.count)) }
      }
    }
    lock.unlock()
    var out: [Float] = [], est: [Float] = []
    var off = 0
    let per = 1024 / N                                           // 아래 횟수·평활은 64ms 블록 기준으로 잡았던 값이다
    while micFifo.count - off >= N {
      var o = [Float](repeating: 0, count: N)
      var re: Float = 0
      micFifo.withUnsafeBufferPointer { m in refFifo[0].withUnsafeBufferPointer { r0 in refFifo[1].withUnsafeBufferPointer { r1 in
        for i in 0..<N { let v = r0[off + i]; re += v * v }
        o.withUnsafeMutableBufferPointer { aec.block(m.baseAddress! + off, [r0.baseAddress! + off, r1.baseAddress! + off], $0.baseAddress!) }
      } } }
      refEnergy += (1 - pow(0.8, 1 / Float(per))) * (re / Float(N) - refEnergy); refNow = re / Float(N)
      if dumpLeft > 0 {
        dumpMic.append(contentsOf: micFifo[off..<off + N]); dumpOut.append(contentsOf: o)
        for c in 0..<C { dumpRef[c].append(contentsOf: refFifo[c][off..<off + N]) }
        dumpLeft -= 1
        if dumpLeft == 0 { onDump?(dumpMic, dumpRef, dumpOut, dumpMicLog, dumpRefLog); dumpMic = []; dumpRef = [[Float]](repeating: [], count: C); dumpOut = [] }
      }
      for i in 0..<N { est.append(micFifo[off + i] - o[i]) }
      out.append(contentsOf: o); off += N
      // 참조가 뚜렷한데(−40dB 넘음) 거의 못 지우는 블록을 센다(지연이 달라졌는지 볼 때 쓴다)
      if re / Float(N) > 1e-4 { if aec.erleDb < 3 { stuck += 1 } else if aec.erleDb >= 6 { stuck = 0 } }
      sinceEstimate += 1
    }
    if off > 0 { micFifo.removeFirst(off); for c in 0..<C { refFifo[c].removeFirst(off) } }
    // 지연을 아직 모르면 0.5초마다 찾아 본다. 아는데도 참조가 뚜렷한 동안 6초 넘게 거의 못 지우면(지연이 달라졌을 수 있다) 다시 찾는다
    // — 다른 값이 나오면 2초 뒤 한 번 더 재서 같을 때만 바꾼다(estimateDelay)
    if hist.count >= W && ((!delayKnown && sinceEstimate >= 8 * per) || (delayKnown && stuck >= 100 * per && sinceEstimate >= (candidate == nil ? 100 : 32) * per)) { estimateDelay() }
    return (out, est)
  }

  // 마이크와 참조(가운데 채널)의 상관(GCC-PHAT)에서 스피커→마이크 지연을 찾는다(−0.2~0.5초).
  // 참조에 소리가 뚜렷할 때만(−40dB 넘음), 그리고 참조에 소리가 있는 주파수(150~4000Hz 가운데 그 대역 평균의 0.1% 넘는 곳)만 써서 잰다.
  // 모든 주파수를 똑같이 쳐 주면 노래가 잦아들 때 소리가 없는 고역의 잡음끼리 지연 0 에서 맞아떨어져 지연을 0ms 로 잘못 잡았고,
  // 그때마다 필터를 비워 10초쯤 노래가 새었다(2026-10-02 실측: 곡이 끝나는 대목에서 24ms → 0ms → 24ms).
  private func estimateDelay() {
    sinceEstimate = 0
    guard let h0 = histRef0 else { return }
    var r: [Float] = []; r.reserveCapacity(W)
    lock.lock(); readRef(0, h0, W, into: &r); lock.unlock()
    var re: Float = 0
    vDSP_measqv(r, 1, &re, vDSP_Length(W))
    if re < 1e-4 { return }                                       // 참조가 조용하다 — 다음에
    let zero = [Float](repeating: 0, count: W)
    var mR = zero, mI = zero, rR = zero, rI = zero
    vDSP_DFT_Execute(fwdW, hist, zero, &mR, &mI)
    vDSP_DFT_Execute(fwdW, r, zero, &rR, &rI)
    let kLo = Int(150 / RefEcho.SR * Double(W)), kHi = Int(4000 / RefEcho.SR * Double(W))
    var meanP: Float = 0
    for k in kLo..<kHi { meanP += rR[k] * rR[k] + rI[k] * rI[k] }
    meanP /= Float(kHi - kLo)
    var cR = zero, cI = zero
    for k in 0..<W {
      let kk = k <= W / 2 ? k : W - k
      guard kk >= kLo, kk < kHi, rR[k] * rR[k] + rI[k] * rI[k] >= 0.001 * meanP else { continue }
      let a = mR[k] * rR[k] + mI[k] * rI[k], b = mI[k] * rR[k] - mR[k] * rI[k]   // M·conj(R)
      let mag = (a * a + b * b).squareRoot() + 1e-12
      cR[k] = a / mag; cI[k] = b / mag
    }
    var tR = zero, tI = zero
    vDSP_DFT_Execute(invW, cR, cI, &tR, &tI)
    // 두 흐름의 시각 표시가 서로 어긋나 있으면 에코가 참조보다 앞선 것처럼 보일 수도 있다 → 앞쪽(−0.2초)까지 찾는다
    let maxLag = 8000, minLag = -3200
    var best = 0, peak: Float = 0, sq: Float = 0
    for k in minLag..<maxLag { let v = abs(tR[k < 0 ? W + k : k]); sq += v * v; if v > peak { peak = v; best = k } }
    let rms = (sq / Float(maxLag - minLag)).squareRoot()
    estimates += 1; lastPeakRatio = peak / max(rms, 1e-12); lastLag = best
    guard peak > 15 * rms else { return }                         // 봉우리가 뚜렷하지 않다(에코가 약하거나 말소리뿐) — 그대로 둔다(노래면 30배쯤 나온다)
    let want = best - 96                                          // 에코가 필터 앞머리 6ms 쯤에 오게
    if abs(want - delay) <= 16 { delayKnown = true; candidate = nil; stuck = 0; return }   // 지금 값이 맞다
    // 이미 맞춰 둔 지연과 다르게 나왔으면 한 번 더 재서 같은 값일 때만 바꾼다(바꾸면 필터를 비우고 처음부터 배워야 한다)
    if delayKnown, candidate == nil || abs(candidate! - want) > 8 { candidate = want; return }
    delayKnown = true; candidate = nil; stuck = 0
    delay = want
    aec.reset()
    onInfo?("에코 지연 \(Int(Double(best) / RefEcho.SR * 1000))ms 로 맞춤")
  }
}

// 시스템 출력(스피커로 나가는 모든 앱의 소리)을 받아 와 RefEcho 에 넣는다. Core Audio 프로세스 탭(macOS 14.2+) + 그 탭을 담은 묶음 장치.
// 받아 보기만 하고 소리는 그대로 난다(muteBehavior unmuted). 허용을 받기 전에는 무음이 온다.
final class RefTap {
  private var tapID = AudioObjectID(kAudioObjectUnknown), aggID = AudioObjectID(kAudioObjectUnknown)
  private var procID: AudioDeviceIOProcID?
  private let queue = DispatchQueue(label: "sttd.reftap", qos: .userInitiated)
  private var converter: AVAudioConverter?
  private var msFormat: AVAudioFormat?   // 탭의 표본 속도 그대로, 두 채널(가운데 M=(L+R)/2·옆 S=(L−R)/2)
  private var channels = 2, interleaved = false
  private let out16 = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: RefEcho.SR, channels: 2, interleaved: false)!
  private var echo: RefEcho?
  private var outputListener: AudioObjectPropertyListenerBlock?
  private(set) var note = ""   // 켠 뒤의 한 줄 설명(로그용)
  private var described = false, formatFlags: UInt32 = 0
  private(set) var noHostTime = 0   // 시각이 없는 콜백 수(진단)

  private static func defaultOutputUID() -> String? {
    var dev = AudioObjectID(0); var size = UInt32(MemoryLayout<AudioObjectID>.size)
    var a = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &a, 0, nil, &size, &dev) == noErr, dev != 0 else { return nil }
    var u = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceUID, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var s: Unmanaged<CFString>? = nil; var ss = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(dev, &u, 0, nil, &ss, &s) == noErr, let str = s?.takeRetainedValue() else { return nil }
    return str as String
  }

  // 켠다. 됐으면 nil, 아니면 못 켠 까닭
  func start(_ echo: RefEcho) -> String? {
    stop()
    self.echo = echo
    guard #available(macOS 14.2, *) else { return "macOS 14.2 이상이어야 해" }
    guard let outUID = RefTap.defaultOutputUID() else { return "기본 출력 장치를 못 찾았어" }
    let desc = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
    desc.uuid = UUID(); desc.name = "skinclaude-ref"; desc.isPrivate = true; desc.muteBehavior = .unmuted
    var tap = AudioObjectID(kAudioObjectUnknown)
    var err = AudioHardwareCreateProcessTap(desc, &tap)
    guard err == noErr, tap != kAudioObjectUnknown else { return "시스템 오디오 탭을 못 만들었어(\(err))" }
    tapID = tap
    var asbd = AudioStreamBasicDescription(); var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    var fa = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    err = AudioObjectGetPropertyData(tap, &fa, 0, nil, &size, &asbd)
    guard err == noErr, asbd.mSampleRate > 0, asbd.mFormatID == kAudioFormatLinearPCM, asbd.mFormatFlags & kAudioFormatFlagIsFloat != 0, asbd.mBitsPerChannel == 32,
          let ms = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: asbd.mSampleRate, channels: 2, interleaved: false),
          let conv = AVAudioConverter(from: ms, to: out16) else { stop(); return "탭의 소리 형식을 쓸 수 없어(\(err), \(asbd.mSampleRate)Hz \(asbd.mChannelsPerFrame)ch)" }
    channels = max(1, Int(asbd.mChannelsPerFrame)); interleaved = asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved == 0
    formatFlags = asbd.mFormatFlags; described = false
    msFormat = ms; converter = conv
    let agg: [String: Any] = [
      kAudioAggregateDeviceNameKey: "skinclaude-ref",
      kAudioAggregateDeviceUIDKey: UUID().uuidString,
      kAudioAggregateDeviceMainSubDeviceKey: outUID,
      kAudioAggregateDeviceIsPrivateKey: true,
      kAudioAggregateDeviceIsStackedKey: false,
      kAudioAggregateDeviceTapAutoStartKey: true,
      kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outUID]],
      kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: desc.uuid.uuidString]],
    ]
    var dev = AudioObjectID(kAudioObjectUnknown)
    err = AudioHardwareCreateAggregateDevice(agg as CFDictionary, &dev)
    guard err == noErr, dev != kAudioObjectUnknown else { stop(); return "탭을 담을 묶음 장치를 못 만들었어(\(err))" }
    aggID = dev
    err = AudioDeviceCreateIOProcIDWithBlock(&procID, dev, queue) { [weak self] _, inData, inTime, outData, _ in self?.onAudio(inData, inTime, outData) }
    guard err == noErr, procID != nil else { stop(); return "탭 소리를 받는 길을 못 열었어(\(err))" }
    err = AudioDeviceStart(dev, procID)
    guard err == noErr else { stop(); return "탭을 시작하지 못했어(\(err))" }
    note = "\(Int(asbd.mSampleRate))Hz \(channels)ch"
    // 출력 장치가 바뀌면(이어폰 연결 등) 그 장치에 맞춰 다시 만든다
    var oa = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    let listener: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
      guard let self, let e = self.echo else { return }
      self.queue.asyncAfter(deadline: .now() + 0.5) {
        guard self.aggID != kAudioObjectUnknown else { return }   // 그새 껐다
        let why = self.start(e)
        emit(["type": "info", "message": why == nil ? "출력 장치가 바뀜 → 참조 에코 제거 다시 켬 (\(self.note))" : "출력 장치가 바뀐 뒤 참조 에코 제거를 못 켰어: \(why!)"])
      }
    }
    if AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &oa, queue, listener) == noErr { outputListener = listener }
    return nil
  }
  func stop() {
    if let l = outputListener {
      var oa = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
      AudioObjectRemovePropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &oa, queue, l); outputListener = nil
    }
    if aggID != kAudioObjectUnknown {
      if let p = procID { AudioDeviceStop(aggID, p); AudioDeviceDestroyIOProcID(aggID, p) }
      AudioHardwareDestroyAggregateDevice(aggID)
    }
    procID = nil; aggID = AudioObjectID(kAudioObjectUnknown)
    if tapID != kAudioObjectUnknown, #available(macOS 14.2, *) { AudioHardwareDestroyProcessTap(tapID) }
    tapID = AudioObjectID(kAudioObjectUnknown)
    converter = nil
  }
  func shutdown() { stop(); echo = nil }

  private func onAudio(_ inData: UnsafePointer<AudioBufferList>, _ inTime: UnsafePointer<AudioTimeStamp>, _ outData: UnsafeMutablePointer<AudioBufferList>) {
    // 이 묶음 장치로는 소리를 내지 않는다: 출력 쪽 버퍼는 비워 둔다
    for b in UnsafeMutableAudioBufferListPointer(outData) { if let p = b.mData { memset(p, 0, Int(b.mDataByteSize)) } }
    guard let echo, let conv = converter, let ms = msFormat else { return }
    let bufs = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inData))
    guard bufs.count > 0, let first = bufs[0].mData else { return }
    if !described { // 진단: 탭이 주는 버퍼가 형식과 맞는지 한 번 적는다
      described = true
      let shape = bufs.map { "\($0.mNumberChannels)ch/\($0.mDataByteSize)B" }.joined(separator: ",")
      let outs = UnsafeMutableAudioBufferListPointer(outData).map { "\($0.mNumberChannels)ch/\($0.mDataByteSize)B" }.joined(separator: ",")
      emit(["type": "info", "message": "참조 탭 첫 소리: 입력 버퍼 [\(shape)] 출력 버퍼 [\(outs)] 형식 플래그 0x\(String(formatFlags, radix: 16)) \(interleaved ? "섞어 담음" : "채널별") 시각 \(inTime.pointee.mFlags.contains(.hostTimeValid) ? "있음" : "없음")"])
    }
    if !inTime.pointee.mFlags.contains(.hostTimeValid) { noHostTime += 1 }
    // 왼쪽·오른쪽을 가운데 M=(L+R)/2 와 옆 S=(L−R)/2 로 바꿔 담는다(채널이 하나면 옆은 0, 셋 이상이면 앞의 둘만 쓴다)
    let frames = interleaved ? Int(bufs[0].mDataByteSize) / (4 * channels) : Int(bufs[0].mDataByteSize) / 4
    guard frames > 0, let m = AVAudioPCMBuffer(pcmFormat: ms, frameCapacity: AVAudioFrameCount(frames)), let mid = m.floatChannelData?[0], let side = m.floatChannelData?[1] else { return }
    if interleaved {
      let p = first.assumingMemoryBound(to: Float.self)
      for i in 0..<frames { let l = p[i * channels], r = channels > 1 ? p[i * channels + 1] : l; mid[i] = (l + r) * 0.5; side[i] = (l - r) * 0.5 }
    } else {
      let lp = first.assumingMemoryBound(to: Float.self)
      let rp = bufs.count > 1 && channels > 1 ? bufs[1].mData?.assumingMemoryBound(to: Float.self) : nil
      for i in 0..<frames { let l = lp[i], r = rp?[i] ?? l; mid[i] = (l + r) * 0.5; side[i] = (l - r) * 0.5 }
    }
    m.frameLength = AVAudioFrameCount(frames)
    guard let out = AVAudioPCMBuffer(pcmFormat: out16, frameCapacity: AVAudioFrameCount(Double(frames) * RefEcho.SR / ms.sampleRate) + 64) else { return }
    var given = false; var err: NSError?
    conv.convert(to: out, error: &err) { _, st in if given { st.pointee = .noDataNow; return nil }; given = true; st.pointee = .haveData; return m }
    guard err == nil, out.frameLength > 0, let o0 = out.floatChannelData?[0], let o1 = out.floatChannelData?[1] else { return }
    let host = inTime.pointee.mFlags.contains(.hostTimeValid) ? inTime.pointee.mHostTime : mach_absolute_time()
    echo.pushRef([UnsafePointer(o0), UnsafePointer(o1)], count: Int(out.frameLength), at: AVAudioTime.seconds(forHostTime: host))
  }
}

// 말소리 대역(300~3400Hz)만 남겨 32ms 덩이마다 크기(RMS)를 잰다. 두 흐름을 같이 넣는다: 에코를 뺀 소리와 그때 뺀 소리(에코 추정).
// 방 소음(대부분 60~150Hz)과 지운 뒤 남는 노래(80%가 200Hz 아래)는 이 대역 밖이고, 말소리는 크기의 60~70%가 이 안에 있다(2026-10-02 실측).
final class SpeechBand {
  static let block = 512
  private var hb: [Float] = [], ha: [Float] = [], lb: [Float] = [], la: [Float] = []   // 2차 버터워스: 고역 통과 300Hz · 저역 통과 3400Hz
  private var z = [Float](repeating: 0, count: 8)                                      // 흐름 둘 × 필터 둘 × 상태 둘
  private var acc: (Float, Float) = (0, 0), n = 0
  init() {
    func coef(_ fc: Double, high: Bool) -> ([Float], [Float]) {
      let w = 2 * Double.pi * fc / RefEcho.SR, c = cos(w), al = sin(w) / (2 * 0.7071067811865476), a0 = 1 + al
      let b: [Double] = high ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [(1 - c) / 2, 1 - c, (1 - c) / 2]
      return (b.map { Float($0 / a0) }, [Float(-2 * c / a0), Float((1 - al) / a0)])
    }
    (hb, ha) = coef(300, high: true); (lb, la) = coef(3400, high: false)
  }
  func reset() { for i in 0..<8 { z[i] = 0 }; acc = (0, 0); n = 0 }
  private func run(_ x: Float, _ o: Int) -> Float {
    let h = hb[0] * x + z[o]
    z[o] = hb[1] * x - ha[0] * h + z[o + 1]; z[o + 1] = hb[2] * x - ha[1] * h
    let l = lb[0] * h + z[o + 2]
    z[o + 2] = lb[1] * h - la[0] * l + z[o + 3]; z[o + 3] = lb[2] * h - la[1] * l
    return l
  }
  // 같은 길이의 두 흐름을 넣으면 512표본(32ms)마다 each(첫째의 크기, 둘째의 크기)를 부른다
  func feed(_ a: [Float], _ b: [Float], each: (Float, Float) -> Void) {
    for i in 0..<min(a.count, b.count) {
      let u = run(a[i], 0), v = run(b[i], 4)
      acc.0 += u * u; acc.1 += v * v; n += 1
      if n == SpeechBand.block {
        each((acc.0 / Float(n)).squareRoot(), (acc.1 / Float(n)).squareRoot())
        acc = (0, 0); n = 0
      }
    }
  }
}

final class Ear {
  private var engine: AVAudioEngine?
  private var analyzer: SpeechAnalyzer?
  private var input: AsyncStream<AnalyzerInput>.Continuation?
  private var results: Task<Void, Never>?
  // 듣는 동안 macOS 가 이 헬퍼를 재우거나(App Nap) 타이머를 늦추지 않게(화면보호기 중에도 부르면 답하기, 2026-10-01).
  // 맥이 스스로 잠드는 것까지 막지는 않는다(AllowingIdleSystemSleep).
  private var activity: NSObjectProtocol?
  // 말 끝 감지: 마이크 소리 크기(RMS)로 '마지막으로 말소리가 난 때'를 잰다. 확정(final)에 sinceSpeechMs 로 실어 받아쓰기 지연을
  // 실사용에서 본다(2026-10-01 반응 속도). 말 끝 판정(watchEnd)의 "조용한지"에도 쓴다.
  private var lastSpeechAt: TimeInterval = 0
  private var noiseFloor: Float = 0.003     // 주변 소리 크기(말이 아닐 때의 마이크 크기. 조용한 방 0.003, 노래가 나오면 노래 크기)
  private var peakRms: Float = 0            // 이번 말에서 가장 큰 소리(확정에 실어 문턱값을 맞추는 데 쓴다)
  private var chanAt: TimeInterval = 0
  private var fedFrames: Int64 = 0   // 받아쓰기에 넣은 소리 길이(프레임, 받아쓰기 형식 기준) — 결과의 range 와 견준다
  private var levelWinMax: Float = 0, levelWinAt: TimeInterval = 0 // SKINCLAUDE_STT_LEVELS=1 이면 0.25초마다 소리 크기를 흘린다(지연 측정용)
  private let levels = ProcessInfo.processInfo.environment["SKINCLAUDE_STT_LEVELS"] == "1"
  private var forcing = false       // finalize 를 부른 뒤 확정을 기다리는 중
  private var endMs: Double = 0             // 말 끝 판정: 말소리 뒤 이만큼 조용하면 확정을 당긴다(0 이면 Apple 확정만)
  // 이름을 불러야만 받는 때(main 이 알려 주는 이어 듣기 창·유예 밖)에 짧은 말(이름만 부른 것, 말소리 quickMaxSec 이하)이면
  // quickEndMs 만 조용해도 확정을 당긴다(사용자 2026-10-04 "이름을 불렀을 때 좀더 빠르게 반응하면 좋겠다"). 문장은 그대로 endMs
  // (사용자 2026-10-01 "말 끝 여유 +1초"). 이름 뒤에 쉬었다가 부탁을 이어 말해도, 이름만 먼저 확정되고 부탁은 열린 이어 듣기 창에서 받는다.
  private var quickEndMs: Double = 0, quickMaxSec: Double = 1.3
  private var awakeUntilMs: Double = 0      // 이어 듣기 창(유예 포함)의 끝, epoch ms
  private var quickForced = false           // 방금 당긴 확정이 짧은 말 규칙이었는지(로그용)
  private var speechSec = 0.0               // 이번 말에서 말소리 크기였던 시간(초)
  private(set) var inBurst = false          // 말하는 중(주변 소리보다 뚜렷이 큰 소리가 이어지는 중)
  private var aboveSec = 0.0, burstAt: TimeInterval = 0, burstAvg: Float = 0
  var clock: () -> TimeInterval = { Date().timeIntervalSince1970 }   // 시험(--aec-test)에서는 파일 속 시각으로 바꿔 쓴다
  // 참조 방식 에코 제거를 쓸 때의 판정(noteBand)용: 말소리 대역 필터, 방 소음(n0²), 노래가 남는 비율(rho² = rhoA/rhoB)
  private let band = SpeechBand()
  private var n0sq: Float = 0.0015 * 0.0015, rhoA: Float = 1e-12, rhoB: Float = 1e-12, rho2: Float = 1
  private var missBlk = 0, hotBlk = 0, runPeak: Float = 0, burstE: Float = 0, burstY: Float = 0, burstN: Float = 0, burstLow: Float = 0
  private var bandBlocks = 0 // 듣기를 시작한 뒤 본 덩이 수(첫 1초는 방 소음만 배운다)
  private var lastFinalPeak: Float = 0, lastFinalAt: TimeInterval = 0 // 바로 앞 확정의 소리 크기(한 말이 확정 둘로 나뉘어 올 때 뒤의 것에도 쓴다)
  // 참조 방식 에코 제거(aec "ref"): 시스템 출력 탭과 필터, 상태 알림용
  private var refEcho: RefEcho?, refTap: RefTap?
  private var refStatAt: TimeInterval = 0, refSilentSince: TimeInterval = 0, refWarned = false, refHeard = false, refDiag = ""
  private var micNoHostTime = 0, dumpCheckAt: TimeInterval = 0
  private var micInTotal: Int64 = 0, micOutTotal: Int64 = 0   // 16kHz 변환기에 넣은 프레임 수·나온 표본 수(나온 표본의 시각을 정하는 데 쓴다)
  private var calibrateUntil: TimeInterval = 0 // 이때까지는 주변 소리 크기를 빨리 맞추기만 한다(노래가 막 시작됨)
  private var noisyBurst = false            // 이번 말이 시끄러운 주변(노래) 위에서 시작됐는지
  private var forcedAt: TimeInterval = 0    // finalize 를 부른 때
  private var endTimer: DispatchSourceTimer?
  private var fast = false
  private var japanese = false       // 일본어로 듣는 중(확정·부분 결과에 발음 토큰을 싣는다)
  private var engineKind = "speech"  // "speech"(SpeechTranscriber) | "dictation"(DictationTranscriber)
  private var aecMode = "auto"       // 마이크에 섞이는 스피커 소리(노래) 지우기: off | ref(참조 방식) | auto·on(VPIO 음성 처리)
  private var engineAec = false      // 지금 엔진이 에코 제거로 열려 있는지
  private var listening = false      // start 뒤 stop 전(엔진이 죽어도 다시 열어야 하는 동안)
  private let engineQ = DispatchQueue(label: "sttd.engine")
  private var configObserver: NSObjectProtocol?
  private var othersPlaying = false  // 다른 앱이 스피커로 소리를 내는 중(OutputWatch 가 알려 준다)
  private var format: AVAudioFormat? // 받아쓰기가 받는 형식
  private let lock = NSLock()
  private func sync<T>(_ body: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return body() }
  private var _paused = false
  var paused: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _paused }
    set { lock.lock(); _paused = newValue; lock.unlock() }
  }

  // 언어에 맞는 받아쓰기 모듈. 모델이 없으면 한 번 내려받는다(ko_KR·ja_JP 는 설치돼 있다).
  private func makeTranscriber(_ id: String) async -> SpeechTranscriber? {
    guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: id)) else { fail("지원하지 않는 언어: \(id)"); return nil }
    let t = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: fast ? [.volatileResults, .fastResults] : [.volatileResults], attributeOptions: [])
    do {
      _ = try? await AssetInventory.reserve(locale: locale)
      if let req = try await AssetInventory.assetInstallationRequest(supporting: [t]) { try await req.downloadAndInstall() }
    } catch { fail("받아쓰기 모델 준비 실패: \(error.localizedDescription)"); return nil }
    return t
  }
  // 받아쓰기 전용 모듈(짧은 말·먼 거리용 힌트, 자주 확정). 시리 받아쓰기 계열이라 짧은 명령에 맞다.
  private func makeDictation(_ id: String) async -> DictationTranscriber? {
    guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: Locale(identifier: id)) else { fail("받아쓰기 전용 모듈이 지원하지 않는 언어: \(id)"); return nil }
    let t = DictationTranscriber(locale: locale, contentHints: [.shortForm, .farField], transcriptionOptions: [.punctuation],
                                 reportingOptions: [.volatileResults, .frequentFinalization], attributeOptions: [])
    do {
      if let req = try await AssetInventory.assetInstallationRequest(supporting: [t]) { try await req.downloadAndInstall() }
    } catch { fail("받아쓰기 전용 모델 준비 실패: \(error.localizedDescription)"); return nil }
    return t
  }

  // 결과 한 건(부분·확정) 처리: 두 모듈(SpeechTranscriber·DictationTranscriber)이 같이 쓴다.
  private func handle(text raw: AttributedString, isFinal: Bool, from: Double, to: Double) {
    let text = String(raw.characters).trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { return }
    if isFinal {
      let now = Date().timeIntervalSince1970
      let since = lastSpeechAt > 0 ? Int((now - lastSpeechAt) * 1000) : -1
      // forced: 말 끝 판정(watchEnd)이 finalize 로 당겨 받은 확정인지(로그용)
      let (forced, quick) = sync { () -> (Bool, Bool) in let f = self.forcedAt > 0 && now - self.forcedAt < 2.0; let q = f && self.quickForced; self.forcedAt = 0; self.quickForced = false; return (f, q) }
      // 받아쓰기는 한 말을 확정 둘로 나눠 주기도 한다("音楽止めて。"+"止めて"). 뒤의 것은 잰 소리가 거의 없으니 1초 안에 온 앞 확정의 크기를 잇는다
      let peak = max(peakRms, now - lastFinalAt < 1.0 ? lastFinalPeak : 0)
      lastFinalPeak = peak; lastFinalAt = now
      var ev: [String: Any] = ["type": "final", "text": text, "sinceSpeechMs": since, "forced": forced, "quick": quick, "peakRms": Double(peak), "noiseFloor": Double(noiseFloor), "aec": engineAec,
                               "echo": refEcho != nil, "band": refEcho != nil, "noisy": forced && noisyBurst]
      if japanese { ev["tokens"] = Ear.readings(text, max: 60) }
      emit(ev)
      peakRms = 0
    } else {
      var ev: [String: Any] = ["type": "partial", "text": text]
      if japanese { ev["tokens"] = Ear.readings(text) }
      if levels { ev["from"] = from; ev["to"] = to; ev["fed"] = Double(fedFrames) / (format?.sampleRate ?? 16000) }
      emit(ev)
    }
  }
  private func watch(_ t: SpeechTranscriber) -> Task<Void, Never> {
    Task {
      do { for try await r in t.results { self.handle(text: r.text, isFinal: r.isFinal, from: r.range.start.seconds, to: r.range.end.seconds) } }
      catch is CancellationError { // 언어를 바꾸거나 끌 때 정상적으로 나는 취소
      } catch { if !Task.isCancelled { fail("받아쓰기 오류: \(error.localizedDescription)") } }
    }
  }
  private func watch(_ t: DictationTranscriber) -> Task<Void, Never> {
    Task {
      do { for try await r in t.results { self.handle(text: r.text, isFinal: r.isFinal, from: r.range.start.seconds, to: r.range.end.seconds) } }
      catch is CancellationError {
      } catch { if !Task.isCancelled { fail("받아쓰기 오류: \(error.localizedDescription)") } }
    }
  }
  static func letters(_ s: String) -> String { String(s.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }) }
  // 일본어 글의 앞 낱말 몇 개를 [로마자 발음, 원문에서 그 낱말이 끝나는 자리(UTF-16)]로. 받아쓰기는 이름을 흔한 한자로 달리 적는다
  // (頂天ちゃん·超天ちゃん·笑点ちゃん, 雨ちゃん·姉ちゃん·アナちゃん) — 글자 대신 발음으로 이름을 맞추려고 main(voice.js)에 넘긴다.
  static func readings(_ text: String, max: Int = 7) -> [[Any]] {
    let cf = text as CFString
    let tok = CFStringTokenizerCreate(nil, cf, CFRangeMake(0, CFStringGetLength(cf)), kCFStringTokenizerUnitWord, Locale(identifier: "ja") as CFLocale)
    var out: [[Any]] = []
    while out.count < max, !CFStringTokenizerAdvanceToNextToken(tok).isEmpty {
      let r = CFStringTokenizerGetCurrentTokenRange(tok)
      let latin = (CFStringTokenizerCopyCurrentTokenAttribute(tok, kCFStringTokenizerAttributeLatinTranscription) as? String) ?? ""
      out.append([latin, r.location + r.length])
    }
    return out
  }
  // 이름("超てんちゃん" 등)을 흔한 말("頂点"·"書店")로 잘못 적지 않게 힌트를 준다
  private func hint(_ analyzer: SpeechAnalyzer, _ words: [String]) async {
    guard !words.isEmpty else { return }
    let ctx = AnalysisContext()
    ctx.contextualStrings = [.general: words]
    do { try await analyzer.setContext(ctx) } catch { fail("이름 힌트 설정 실패: \(error.localizedDescription)") }
  }

  // (참조 방식 에코 제거를 쓸 때는 이 함수 대신 noteBand 가 판정한다. 여기는 에코 제거 없이 듣거나 VPIO 를 쓸 때다.)
  // 마이크 소리 크기 한 덩이(약 85ms)를 보고 '말하는 중'을 가린다. 기준은 주변 소리(ambient): 말이 아닐 때의 크기를 2초쯤의 빠르기로
  // 따라간다 — 조용한 방이면 바닥 소음, 노래가 나오면 노래 크기다. 그보다 2배(6dB) 넘게 큰 소리가 0.17초 넘게 이어지면 말이 시작된 것으로 본다.
  // 노래 위로 말해도(에코 제거 없이) 그 말만 떼어 내려는 것 — 사용자: "내가 말할 때 말고는 스피커 소리를 왜곡하지 말아라"(2026-10-01).
  // 세는 단위는 시간(초)이다: 덩이 길이가 달라도 같은 빠르기로 움직이게 평활 계수도 덩이 길이에 맞춘다(85ms 덩이 기준 값).
  private func noteLevel(_ rms: Float, seconds: Double, aec: Bool) {
    let now = clock()
    if rms > peakRms { peakRms = rms }
    if levels {
      if rms > levelWinMax { levelWinMax = rms }
      if now - levelWinAt >= 0.25 { emit(["type": "level", "rms": Double(levelWinMax), "ambient": Double(noiseFloor)]); levelWinMax = 0; levelWinAt = now }
    }
    let k = { (c: Float) -> Float in 1 - pow(1 - c, Float(seconds / 0.0853)) }
    // 말로 볼 가장 작은 크기. 방이 아주 조용하면(바닥 0.001) 작게 말한 소리(0.009)가 0.008 에 걸려 말 끝 판정이 안 돌았고,
    // 그러면 Apple 확정을 기다리느라 25~81초가 걸렸다(2026-10-01 실사용). 바닥의 4배까지 낮춘다(0.003~0.008).
    let absMin: Float = aec ? 0.004 : max(0.003, min(0.008, noiseFloor * 4))
    // 다른 앱 소리가 막 나기 시작했으면(노래 시작) 2초 동안은 말로 보지 않고 주변 소리 크기를 빨리 맞춘다
    if now < calibrateUntil { noiseFloor += (rms - noiseFloor) * k(0.25); inBurst = false; aboveSec = 0; return }
    if !inBurst {
      if rms > max(absMin, noiseFloor * 2.0) { aboveSec += seconds } else {
        aboveSec = 0
        noiseFloor += (rms - noiseFloor) * k(rms < noiseFloor ? 0.10 : 0.04) // 주변 소리를 따라간다(내려갈 땐 빨리)
      }
      guard aboveSec >= 0.16 else { return }
      // 말 시작. (말 시작 앞까지를 finalize(through:) 로 먼저 털어 내 봤지만 이름까지 같이 털려 나갔다 — 하지 않는다)
      inBurst = true; burstAt = now; burstAvg = rms
      emit(["type": "speech", "rms": Double(rms), "aec": aec, "ambient": Double(noiseFloor)])
      lastSpeechAt = now
      let started = aboveSec
      sync { self.speechSec = started }
      aboveSec = 0
      noisyBurst = noiseFloor > 0.008 // 노래 같은 소리 위로 말한 것 — 확정 글 앞에 가사가 붙어 올 수 있다(main 이 이름을 글 중간에서도 찾는다)
    } else {
      burstAvg += (rms - burstAvg) * k(0.1)
      if rms > max(absMin * 0.75, noiseFloor * 1.4) { lastSpeechAt = now; sync { self.speechSec += seconds } }
      // 8초 넘게 쉬지 않고 '말하는 중'이면 말이 아니라 주변 소리가 커진 것(노래가 커짐·바뀜) → 기준을 그 크기로 다시 잡는다
      if now - burstAt > 8 { inBurst = false; noiseFloor = burstAvg; sync { self.speechSec = 0 } }
    }
  }

  // 말 끝 판정(0.1초마다): Apple 받아쓰기(정확한 쪽)는 말이 끝나고 3.5~9초 뒤에야 한꺼번에 결과를 준다(2026-10-01 실사용 로그
  // 3491·4832·5020·9193ms, 부분 결과도 그때 몰아서 온다). 말하는 중(noteLevel)이다가 endMs 동안 주변 소리 크기로 돌아와 있으면
  // finalize(through:) 를 부른다 → 0.1초 안에 확정이 온다. 주변이 계속 시끄러워 가려지지 않으면 Apple 확정을 그냥 기다린다.
  private func watchEnd(_ analyzer: SpeechAnalyzer) {
    endTimer?.cancel()
    guard endMs > 0 else { endTimer = nil; return }
    let t = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .userInitiated))
    t.schedule(deadline: .now() + 0.1, repeating: .milliseconds(100))
    t.setEventHandler { [weak self, weak analyzer] in
      guard let self, let analyzer, self.endCheck() else { return }
      Task { do { try await analyzer.finalize(through: nil) } catch { }; self.finalized() }
    }
    t.resume()
    endTimer = t
  }
  // 말이 끝났나: 말하는 중이다가 endMs 동안 말소리가 없었으면 true(확정을 당길 때). 0.25초도 안 되는 소리(딸깍)였으면 넘긴다
  func endCheck() -> Bool {
    guard endMs > 0, !paused, inBurst else { return false }
    let now = clock()
    let quick = sync { self.quickEndMs > 0 && self.speechSec <= self.quickMaxSec && now * 1000 >= self.awakeUntilMs }
    guard lastSpeechAt > 0, (now - lastSpeechAt) * 1000 >= (quick ? quickEndMs : endMs) else { return false } // 아직 말하는 중
    inBurst = false
    return sync {
      let enough = !self.forcing && self.speechSec >= 0.25
      self.speechSec = 0
      if enough { self.forcing = true; self.forcedAt = now; self.quickForced = quick }
      return enough
    }
  }
  func setAwake(until ms: Double) { sync { self.awakeUntilMs = ms } }
  func finalized() { sync { self.forcing = false } }
  func testEnd(ms: Double, quickMs: Double = 0, quickMax: Double = 1.3) { endMs = ms; quickEndMs = quickMs; quickMaxSec = quickMax } // 시험(--aec-test)용

  // 참조 방식 에코 제거를 쓸 때의 '말하는 중' 판정. e = 에코를 뺀 소리, y = 그때 뺀 소리(에코 추정) — 둘 다 말소리 대역의 32ms 크기.
  // 지운 뒤에도 노래가 조금 남는다. 전체 크기와 고정 배수로 보면 그 찌꺼기에 '말하는 중'이 계속 걸려, 말이 끝나도 확정을 당기지 못했다
  // (2026-10-02 모의 실행: 노래 중에 한 말 36개 가운데 끝에서 확정을 당긴 게 0개 → 이 방식으로 36개).
  // 그 순간 '주변 소리가 얼마쯤일지'를 예측해 그보다 뚜렷이 클 때만 말로 본다:
  //   pred² = n0² + rho²·y²   (n0 = 방 소음, rho = 노래가 남는 비율. 둘 다 말이 아닐 때의 에너지 평균으로 배운다)
  // 노래가 커지면 y 가 같이 커지니 문턱도 그 자리에서 따라 올라간다(말하는 중에도). 노래가 없으면 pred = n0 — 조용한 방에서도 이 판정이 낫다:
  // 대역으로 재면 방 소음이 반으로 줄어, 작게 한 말(전체 크기 0.011)도 잡힌다(전에는 문턱 0.008 에 못 미쳐 확정이 10~44초 늦었다).
  func noteBand(e r: Float, y: Float, seconds: Double, cold: Bool) {
    let now = clock()
    let k = { (c: Float) -> Float in 1 - pow(1 - c, Float(seconds / 0.0853)) }
    let ech = rho2 * y * y, pred = (n0sq + ech).squareRoot(), w = ech / (n0sq + ech)
    // 문턱: 조용할 때는 예측의 1.8배(시작)·1.75배(계속), 노래가 남을 때는 3배·2.5배(박자마다 튀는 봉우리가 있다).
    // 조용할 때 2.5배·2배, 바닥 0.003 이던 것을 낮췄다(사용자 2026-10-03 "이름 불러서 호출할때 더 작은 목소리도 인식하도록"): 작게 부른 이름이
    // 말로 안 잡혀(크기 0) 말 끝 판정이 안 돌고 Apple 확정을 기다렸다. 모의 실행(조용한 방 녹음 + 작게 한 말 0.006): 12개 중 1개 → 11개,
    // 방 소음만·노래 중(36개) 헛시작은 그대로 0. 정상 소음은 덩이마다 5%쯤만 흔들려 1.8배를 0.16초 넘게 넘지 않는다.
    // 계속 문턱을 1.5배까지 내리면 말끝 숨·울림이 말로 이어져 보통 크기 말의 확정이 0.3초 늦었다 → 1.75배(늦어짐 없음)
    let thS = max(0.002, (1.8 + 1.2 * w) * pred), thC = max(0.0018, (1.75 + 0.75 * w) * pred)
    // 듣기를 막 시작했으면(첫 1초) 방 소음을 빨리 배우기만 한다: 처음 값(0.0015)보다 시끄러운 방에서 문턱이 낮아 헛시작이 났다(모의 실행)
    let warm = bandBlocks < Int(1.0 / max(seconds, 0.001)); bandBlocks += 1
    noiseFloor += (pred - noiseFloor) * k(0.1)                     // 확정에 싣는 '주변 소리 크기'
    if levels {
      if r > levelWinMax { levelWinMax = r }
      if now - levelWinAt >= 0.25 { emit(["type": "level", "rms": Double(levelWinMax), "ambient": Double(pred), "echo": Double(y), "rho": Double(rho2.squareRoot())]); levelWinMax = 0; levelWinAt = now }
    }
    if !inBurst {
      if r > thS && !cold && !warm { aboveSec += seconds; missBlk = 0; if r > runPeak { runPeak = r } } else {
        if aboveSec > 0 && missBlk < 1 && !cold { missBlk += 1 }   // 말 중간의 짧은 골(자음·숨)은 한 덩이까지 봐준다
        else { aboveSec = 0; missBlk = 0; runPeak = 0 }
        // 주변 소리 배우기(말이 아닐 때만): 노래가 거의 없으면 방 소음, 있으면 남는 비율. 필터가 막 배우는 중(cold)이면 빨리 따라간다
        if ech < 0.25 * n0sq && !cold { n0sq += (r * r - n0sq) * k(warm ? 0.3 : 0.05) }
        else if y > 1e-5 {
          let c = k(cold ? 0.25 : 0.03)
          rhoA += (r * r - n0sq - rhoA) * c; rhoB += (y * y - rhoB) * c
          rho2 = min(9, max(0.0004, rhoA / rhoB))
        }
      }
      guard aboveSec >= 0.16 else { return }
      // 말 시작. 확정에 싣는 '가장 큰 소리'는 말로 잡힌 구간에서만 잰다 — 말로 잡히지 않은 소리(딸깍·남은 노래)의 확정은 크기 0 으로 간다
      inBurst = true; burstAt = now; burstE = 0; burstY = 0; burstN = 0; burstLow = r; hotBlk = 2
      if runPeak > peakRms { peakRms = runPeak }
      runPeak = 0
      emit(["type": "speech", "rms": Double(r), "aec": false, "band": true, "ambient": Double(pred)])
      lastSpeechAt = now
      let started = aboveSec
      sync { self.speechSec = started }
      aboveSec = 0; missBlk = 0
      noisyBurst = w > 0.5 // 노래가 남아 있는 위로 말한 것 — 확정 글 앞에 가사가 붙어 올 수 있다(main 이 이름을 글 중간에서도 찾는다)
    } else {
      if r > peakRms { peakRms = r }
      burstE += r * r; burstY += y * y; burstN += 1
      burstLow += (r - burstLow) * k(r < burstLow ? 0.25 : 0.01)
      if r > thC {
        hotBlk += 1; sync { self.speechSec += seconds }
        if hotBlk >= 2 { lastSpeechAt = now }                      // 두 덩이 이어서 넘어야 말이 이어지는 것으로 본다(박자마다 튀는 한 덩이는 넘긴다)
      } else { hotBlk = 0 }
      // 12초 넘게 쉬지 않고 '말하는 중'이면 말이 아니라 주변 소리가 달라진 것 → 그동안의 값으로 기준을 다시 잡는다
      if now - burstAt > 12 {
        inBurst = false; sync { self.speechSec = 0 }
        if ech > n0sq && burstY > 1e-9 { rho2 = min(9, max(0.0004, (burstE - burstN * n0sq) / burstY)); rhoA = rho2 * rhoB }
        else { n0sq = max(n0sq, burstLow * burstLow) }
      }
    }
  }

  // aecMode: "auto"(기본) 다른 앱이 소리를 낼 때만 에코 제거, "on" 늘, "off" 안 씀
  func start(_ id: String, words: [String] = [], endMs: Double = 0, quickEndMs: Double = 0, quickMaxSec: Double = 1.3, fast: Bool = false, aecMode: String = "auto", engine: String = "speech") async {
    await stop()
    self.endMs = endMs; self.quickEndMs = quickEndMs; self.quickMaxSec = quickMaxSec; self.fast = fast; self.aecMode = aecMode; self.engineKind = engine; self.japanese = id.hasPrefix("ja")
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized: break
    case .notDetermined:
      if !(await AVCaptureDevice.requestAccess(for: .audio)) { fail("마이크 권한이 거부됐어"); return }
    default: fail("마이크 권한이 꺼져 있어(시스템 설정 → 개인정보 보호 → 마이크)"); return
    }
    let module: any SpeechModule
    if engineKind == "dictation" {
      guard let t = await makeDictation(id) else { return }
      module = t; results = watch(t)
    } else {
      guard let t = await makeTranscriber(id) else { return }
      module = t; results = watch(t)
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module]) else { fail("오디오 형식을 정하지 못했어"); return }
    let analyzer = SpeechAnalyzer(modules: [module])
    await hint(analyzer, words)
    let (stream, cont) = AsyncStream<AnalyzerInput>.makeStream()
    do { try await analyzer.start(inputSequence: stream) } catch { fail("받아쓰기 시작 실패: \(error.localizedDescription)"); return }
    self.analyzer = analyzer; self.input = cont; self.format = format

    listening = true
    if aecMode == "ref" { startRef() }
    openEngine()
    paused = false
    lastSpeechAt = 0; forcing = false; speechSec = 0; forcedAt = 0; inBurst = false; aboveSec = 0; noisyBurst = false; missBlk = 0; hotBlk = 0; bandBlocks = 0
    watchEnd(analyzer)
    if activity == nil { activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiatedAllowingIdleSystemSleep, .latencyCritical], reason: "음성 모드 듣기") }
    emit(["type": "ready", "locale": id])
  }

  // 마이크 엔진을 (다시) 연다. 받아쓰기(analyzer)는 그대로 두고 소리를 넣는 쪽만 바꾼다 — 노래가 시작·끝날 때 에코 제거를 켜고 끄기 위해.
  // 에코 제거(VPIO): 맥 스피커로 나가는 다른 앱 소리까지 마이크에서 지운다(2026-10-01 실측: 노래 중 RMS 0.028 → 0.001).
  @discardableResult
  private func startEngine(aec: Bool, quiet: Bool = false) -> Bool {
    stopEngine()
    guard let cont = input, let format else { return false }
    let fail: (String) -> Void = { msg in if quiet { emit(["type": "info", "message": "마이크 다시 여는 중: \(msg)"]) } else { emit(["type": "error", "message": msg]) } }
    let engine = AVAudioEngine()
    let node = engine.inputNode
    if aec {
      do {
        try node.setVoiceProcessingEnabled(true)
        // 음성 처리를 켜면 macOS 가 다른 앱 소리를 줄인다(통화처럼). 노래가 작게 나온다고 해서(사용자 2026-10-01) 가장 덜 줄이게 한다.
        if ProcessInfo.processInfo.environment["SKINCLAUDE_AEC_DUCK"] != "default" {
          node.voiceProcessingOtherAudioDuckingConfiguration = AVAudioVoiceProcessingOtherAudioDuckingConfiguration(enableAdvancedDucking: false, duckingLevel: .min)
        }
        // (출력 경로를 따로 붙이면 엔진이 -10875 로 안 떴다. 붙이지 않아도 입력은 나온다 — 2026-10-01 확인)
        if ProcessInfo.processInfo.environment["SKINCLAUDE_AEC_BYPASS"] == "1" { node.isVoiceProcessingBypassed = true } // 시험: 처리 없이 통과
      } catch { fail("에코 제거를 켜지 못했어: \(error.localizedDescription)") }
    }
    let inFormat = node.outputFormat(forBus: 0)
    // 음성 처리를 켜면 이 맥은 9채널(처리된 소리 + 마이크 원본들)로 준다. 통째로 변환기에 넣으면 받아쓰기가 아무것도 못 알아들었다(사용자 2026-10-01
    // "이름 불러도 반응이 없네"). 처리된 소리인 0번 채널만 떼어 모노로 만든 뒤 변환한다.
    let mono = aec && inFormat.channelCount > 1 ? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: inFormat.sampleRate, channels: 1, interleaved: false) : nil
    guard inFormat.sampleRate > 0, let converter = AVAudioConverter(from: mono ?? inFormat, to: format) else { fail("마이크 입력을 열지 못했어"); return false }
    // 참조 방식 에코 제거: 마이크 → 16kHz 모노 → 에코 빼기 → 받아쓰기 형식. (여러 채널 마이크면 0번 채널만 쓴다)
    let f16 = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: RefEcho.SR, channels: 1, interleaved: false)!
    let echo = refEcho
    let mono1 = echo != nil && inFormat.channelCount > 1 ? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: inFormat.sampleRate, channels: 1, interleaved: false) : nil
    let to16 = echo != nil ? AVAudioConverter(from: mono1 ?? inFormat, to: f16) : nil
    micInTotal = 0; micOutTotal = 0 // 변환기를 새로 만들었으니 세던 것도 처음부터
    let from16 = echo != nil ? AVAudioConverter(from: f16, to: format) : nil
    node.installTap(onBus: 0, bufferSize: 4096, format: inFormat) { [weak self] buffer, when in
      guard let self else { return }
      if let echo, let to16, let from16 { self.feedCleaned(buffer, when, echo, to16, from16, mono1, cont); return }
      guard !self.paused else { return }
      if let ch = buffer.floatChannelData?[0], buffer.frameLength > 0 {
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += ch[i] * ch[i] }
        self.noteLevel((sum / Float(buffer.frameLength)).squareRoot(), seconds: Double(buffer.frameLength) / inFormat.sampleRate, aec: aec)
      }
      if self.levels, let chs = buffer.floatChannelData, buffer.format.channelCount > 1 { // 채널별 소리 크기(음성 처리 9채널 배치를 알아보는 용도)
        let now = Date().timeIntervalSince1970
        if now - self.chanAt >= 0.5 {
          self.chanAt = now
          var r: [Double] = []
          for c in 0..<Int(buffer.format.channelCount) { var sm: Float = 0; for i in 0..<Int(buffer.frameLength) { sm += chs[c][i] * chs[c][i] }; r.append(Double((sm / Float(max(1, buffer.frameLength))).squareRoot())) }
          emit(["type": "chan", "rms": r])
        }
      }
      var source = buffer
      if let mono, let src = buffer.floatChannelData?[0], let one = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: buffer.frameLength), let dst = one.floatChannelData?[0] {
        dst.update(from: src, count: Int(buffer.frameLength)); one.frameLength = buffer.frameLength
        source = one
      }
      let cap = AVAudioFrameCount(Double(source.frameLength) * format.sampleRate / inFormat.sampleRate) + 64
      guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { return }
      var given = false
      var err: NSError?
      converter.convert(to: out, error: &err) { _, status in
        if given { status.pointee = .noDataNow; return nil }
        given = true; status.pointee = .haveData; return source
      }
      if err == nil, out.frameLength > 0 { cont.yield(AnalyzerInput(buffer: out)); self.fedFrames += Int64(out.frameLength) }
    }
    do { try engine.start() } catch { fail("마이크 시작 실패: \(error.localizedDescription)"); node.removeTap(onBus: 0); return false }
    self.engine = engine; self.engineAec = aec
    noiseFloor = aec ? 0.001 : echo != nil ? n0sq.squareRoot() : 0.003; inBurst = false; aboveSec = 0; band.reset()
    emit(["type": "info", "message": "마이크 \(aec ? "에코 제거 켬" : "에코 제거 끔") (\(Int(inFormat.sampleRate))Hz \(inFormat.channelCount)ch)"])
    return true
  }
  // 참조 방식 에코 제거를 거쳐 받아쓰기에 넣는다(마이크 탭에서 부른다)
  private func feedCleaned(_ buffer: AVAudioPCMBuffer, _ when: AVAudioTime, _ echo: RefEcho, _ to16: AVAudioConverter, _ from16: AVAudioConverter,
                           _ mono1: AVAudioFormat?, _ cont: AsyncStream<AnalyzerInput>.Continuation) {
    guard let format, buffer.frameLength > 0 else { return }
    var source = buffer
    if let mono1, let src = buffer.floatChannelData?[0], let one = AVAudioPCMBuffer(pcmFormat: mono1, frameCapacity: buffer.frameLength), let dst = one.floatChannelData?[0] {
      dst.update(from: src, count: Int(buffer.frameLength)); one.frameLength = buffer.frameLength
      source = one
    }
    let inRate = buffer.format.sampleRate
    guard let m16 = AVAudioPCMBuffer(pcmFormat: to16.outputFormat, frameCapacity: AVAudioFrameCount(Double(source.frameLength) * RefEcho.SR / inRate) + 64) else { return }
    var given = false; var err: NSError?
    to16.convert(to: m16, error: &err) { _, st in if given { st.pointee = .noDataNow; return nil }; given = true; st.pointee = .haveData; return source }
    guard err == nil, m16.frameLength > 0, let p = m16.floatChannelData?[0] else { return }
    let mic = Array(UnsafeBufferPointer(start: p, count: Int(m16.frameLength)))
    // 이 덩이 첫 표본의 시각(참조와 같은 호스트 시계)
    if !when.isHostTimeValid { micNoHostTime += 1 }
    let tBuf = when.isHostTimeValid ? AVAudioTime.seconds(forHostTime: when.hostTime) : AVAudioTime.seconds(forHostTime: mach_absolute_time()) - Double(buffer.frameLength) / inRate
    // 이번에 나온 16kHz 표본들의 시각. 변환기는 넣은 만큼을 그때그때 다 내주지 않고 안에 모아 뒀다 내준다(0.1초(1600표본)를 넣으면 1664·1664·…·1365 로 나왔다).
    // 그래서 "이 버퍼의 시각 = 이번 출력의 시각"으로 치면 덩이마다 4~15ms 씩 어긋나 참조와 맞출 수 없었다(2026-10-02 실측: 덩이마다 건너뜀, 지운 양 0dB).
    // 나온 표본을 세어, 이번 출력의 첫 표본이 입력의 몇 번째 프레임인지로 시각을 정한다.
    let t = tBuf + (Double(micOutTotal) * inRate / RefEcho.SR - Double(micInTotal)) / inRate
    micInTotal += Int64(source.frameLength); micOutTotal += Int64(m16.frameLength)
    let (clean, est) = echo.process(mic, at: t)
    noteRef(echo)
    if clean.isEmpty { return }
    // 캐릭터가 말하는 동안에도 필터는 계속 배운다(그 목소리도 스피커로 나가는 참조다). 그동안은 말 판정도 받아쓰기도 쉰다
    let halted = paused, cold = echo.cold
    // 말하는 중인지는 에코를 뺀 소리의 말소리 대역 크기로 본다(noteBand)
    band.feed(clean, est) { e, y in if !halted { self.noteBand(e: e, y: y, seconds: Double(SpeechBand.block) / RefEcho.SR, cold: cold) } }
    if halted { return }
    guard let c16 = AVAudioPCMBuffer(pcmFormat: from16.inputFormat, frameCapacity: AVAudioFrameCount(clean.count)), let dst = c16.floatChannelData?[0] else { return }
    clean.withUnsafeBufferPointer { dst.update(from: $0.baseAddress!, count: clean.count) }
    c16.frameLength = AVAudioFrameCount(clean.count)
    guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(clean.count) * format.sampleRate / RefEcho.SR) + 64) else { return }
    var given2 = false; var err2: NSError?
    from16.convert(to: out, error: &err2) { _, st in if given2 { st.pointee = .noDataNow; return nil }; given2 = true; st.pointee = .haveData; return c16 }
    if err2 == nil, out.frameLength > 0 { cont.yield(AnalyzerInput(buffer: out)); fedFrames += Int64(out.frameLength) }
  }
  // 참조 방식 에코 제거의 상태를 가끔 알린다(로그): 노래가 나오는 동안 10초마다 줄어든 양, 그리고 소리가 나는데 참조가 안 들어올 때 한 번
  private func noteRef(_ echo: RefEcho) {
    let now = Date().timeIntervalSince1970
    // 진단 덤프 요청: ~/.skinclaude/aec-dump 파일(안에 초 수)이 생기면 그만큼 모아 ~/.skinclaude/aec-dump-out/ 에 쓴다
    if now - dumpCheckAt >= 1 {
      dumpCheckAt = now
      let ask = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".skinclaude/aec-dump")
      if let txt = try? String(contentsOf: ask, encoding: .utf8) {
        try? FileManager.default.removeItem(at: ask)
        let sec = max(2, min(60, Double(txt.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 12))
        emit(["type": "info", "message": "참조 에코 제거: 진단 덤프 시작(\(Int(sec))초)"])
        echo.startDump(seconds: sec)
      }
    }
    if echo.refLevel > 1e-4 { refHeard = true }
    if echo.refLevel > 0.002 {
      refSilentSince = 0
      if now - refStatAt >= 10 {
        refStatAt = now
        // 흐름이 끊기거나 어긋난 횟수는 달라졌을 때만 싣는다(같은 시계의 마이크·스피커면 늘 0 이어야 한다)
        let diag = "채움 \(echo.gapFills)번(\(echo.gapSamples)표본) 기준옮김 \(echo.reanchors) 건너뜀 \(echo.jumps) 따라감 \(echo.slips) 지연찾기 \(echo.estimates)번 시각없음 탭 \(refTap?.noHostTime ?? 0)·마이크 \(micNoHostTime)"
        emit(["type": "info", "message": String(format: "참조 에코 제거: 줄어든 양 %.0fdB · 지연 %.0fms · 말소리 대역에 남는 비율 %.3f · 방 소음 %.4f · 참조 크기 %.3f", echo.erleDb, echo.delayMs, rho2.squareRoot(), n0sq.squareRoot(), echo.refLevel)
          + (diag != refDiag ? " · 진단: " + diag + String(format: "(봉우리 %.1f배, %dms)", echo.lastPeakRatio, Int(Double(echo.lastLag) / RefEcho.SR * 1000)) : "")])
        refDiag = diag
      }
    } else if !refHeard && othersPlaying && echo.refLevel < 1e-5 {
      // 허용이 꺼져 있으면 탭은 무음만 준다. 한 번이라도 소리가 들어왔으면 허용은 된 것이다(크롬은 멈춘 뒤에도 10초쯤 '소리 내는 중'으로 남아
      // 그때마다 이 경고가 잘못 났다 — 2026-10-02)
      if refSilentSince == 0 { refSilentSince = now }
      if !refWarned && now - refSilentSince > 20 {
        refWarned = true
        emit(["type": "info", "message": "다른 앱 소리가 나는데 시스템 오디오가 들어오지 않아(허용이 꺼져 있을 수 있어: 시스템 설정 › 개인정보 보호 및 보안 › 화면 및 시스템 오디오 녹음 › 시스템 오디오 녹음만)"])
      }
    } else { refSilentSince = 0 }
  }
  private func startRef() {
    stopRef()
    let echo = RefEcho(), tap = RefTap()
    echo.onInfo = { emit(["type": "info", "message": "참조 에코 제거: \($0)"]) }
    echo.onDump = { mic, ref, out, micLog, refLog in
      let dir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".skinclaude/aec-dump-out")
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      writeWav16(dir.appendingPathComponent("mic.wav").path, mic); writeWav16(dir.appendingPathComponent("out.wav").path, out)
      writeWav16(dir.appendingPathComponent("ref.wav").path, ref[0]); writeWav16(dir.appendingPathComponent("refs.wav").path, ref[1]) // 가운데·옆
      if let d = try? JSONSerialization.data(withJSONObject: ["mic": micLog, "ref": refLog]) { try? d.write(to: dir.appendingPathComponent("times.json")) }
      emit(["type": "info", "message": "참조 에코 제거: 진단 덤프 저장 \(dir.path) (\(mic.count / 16000)초)"])
    }
    if let why = tap.start(echo) { emit(["type": "info", "message": "참조 에코 제거를 못 켰어: \(why) — 에코 제거 없이 듣는다"]); return }
    refEcho = echo; refTap = tap; refStatAt = 0; refSilentSince = 0; refWarned = false; refHeard = false; refDiag = ""
    n0sq = 0.0015 * 0.0015; rhoA = 1e-12; rhoB = 1e-12; rho2 = 1 // 처음엔 '하나도 못 지운다'고 보고 시작한다(배우면서 내려간다)
    emit(["type": "info", "message": "참조 에코 제거 켬 (시스템 출력 \(tap.note))"])
    emit(["type": "echo", "on": true])
  }
  private func stopRef() {
    if refEcho != nil { emit(["type": "echo", "on": false]) }
    refTap?.shutdown(); refTap = nil; refEcho = nil
  }
  // 캐릭터가 다 말했다: 다시 듣는다. 멈춰 있는 동안의 '말하는 중' 표시는 묵은 것이라 비운다
  func resume() { inBurst = false; aboveSec = 0; missBlk = 0; hotBlk = 0; runPeak = 0; sync { self.speechSec = 0 }; paused = false }

  private func stopEngine() {
    if let o = configObserver { NotificationCenter.default.removeObserver(o); configObserver = nil }
    if let e = engine { e.inputNode.removeTap(onBus: 0); e.stop() }
    engine = nil
  }
  // 마이크 엔진을 지금 상황(다른 앱 소리 여부)에 맞게 연다. 실패하면 0.4초 간격으로 다시 시도한다.
  // 에코 제거를 끄고 바로 다시 열면 장치가 바뀌는 중이라 '!dev'(560227702)로 실패했고, 그 뒤로 마이크가 죽은 채였다
  // (2026-10-01 사용자 "이름 불러도 계속 못 알아듣네"). 엔진 조작은 모두 engineQ 한 줄로 세운다.
  private func openEngine(after delay: Double = 0, attempt: Int = 0) {
    engineQ.asyncAfter(deadline: .now() + delay) { [weak self] in
      guard let self, self.listening else { return }
      let want = self.aecMode == "on" || (self.aecMode == "auto" && self.othersPlaying)
      if self.engine != nil, self.engineAec == want { return }      // 이미 맞게 열려 있다
      if self.startEngine(aec: want, quiet: attempt < 12) {
        self.watchConfig()
        if attempt > 0 { emit(["type": "info", "message": "마이크 다시 열림(\(attempt + 1)번째 시도)"]) }
        return
      }
      self.openEngine(after: attempt < 12 ? 0.4 : 3.0, attempt: attempt + 1) // 5초쯤 촘촘히, 그 뒤엔 3초마다 계속
    }
  }
  // 장치 구성이 바뀌면(다른 앱이 음성 처리를 켜고 끔, 이어폰 연결 등) 엔진이 멈춘다 → 다시 연다
  private func watchConfig() {
    guard let e = engine else { return }
    configObserver = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: e, queue: nil) { [weak self] _ in
      guard let self else { return }
      emit(["type": "info", "message": "마이크 장치 구성이 바뀜 → 다시 연다"])
      self.engineQ.async { self.stopEngine() }
      self.openEngine(after: 0.4)
    }
  }
  // 다른 앱 소리가 막 나거나 멈췄다: 주변 소리 크기가 바뀌니 2초 동안 기준을 다시 맞춘다(그동안은 말로 보지 않는다)
  // (참조 방식 에코 제거에서는 하지 않는다: 그쪽 판정은 노래 크기를 그때그때 따라가고, 2초를 쉬면 그사이 한 말의 시작을 놓친다)
  func calibrate() { if refEcho == nil { calibrateUntil = clock() + 2.0 } }
  // 다른 앱 소리가 나기 시작·멈추면(OutputWatch) 자동 모드에서 에코 제거를 켜고 끈다. 듣는 중이 아니면 상태만 기억한다.
  func othersChanged(_ playing: Bool) {
    othersPlaying = playing
    guard aecMode == "auto", listening else { return }
    engineQ.async { [weak self] in
      guard let self, self.listening, self.engine == nil || self.engineAec != playing else { return }
      self.stopEngine()            // 먼저 닫고, 장치가 자리 잡을 시간을 준 뒤 다시 연다
    }
    openEngine(after: 0.4)
  }

  func stop() async {
    listening = false
    endTimer?.cancel(); endTimer = nil
    if let a = activity { ProcessInfo.processInfo.endActivity(a); activity = nil }
    engineQ.sync { self.stopEngine() }
    stopRef()
    results?.cancel(); results = nil // 먼저 결과 읽기를 멈춰야 취소가 오류로 새지 않는다
    input?.finish(); input = nil
    if let a = analyzer { await a.cancelAndFinishNow() }
    analyzer = nil
  }

  // 지금까지 들어온 소리를 바로 확정으로 받는다(시험·수동용. 평소엔 watchEnd 가 말 끝에서 알아서 부른다).
  func flush() async {
    guard let a = analyzer else { return }
    do { try await a.finalize(through: nil) } catch { }
  }


  // 시험용: 마이크 대신 파일 소리를 듣는 중인 받아쓰기에 실시간 속도로 흘려 넣는다(말 끝 판정·삼키기까지 시험). 끝나면 tail 초 동안 무음을 넣는다.
  func feed(_ path: String, tail: Double = 6) async {
    guard let cont = input, let format else { fail("먼저 start 해야 해"); return }
    listening = false
    engineQ.sync { self.stopEngine() }
    do {
      let f = try AVAudioFile(forReading: URL(fileURLWithPath: path))
      guard let conv = AVAudioConverter(from: f.processingFormat, to: format) else { fail("변환기를 못 만들었어"); return }
      let chunk: AVAudioFrameCount = 4096
      while f.framePosition < f.length {
        guard let inBuf = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: chunk) else { break }
        try f.read(into: inBuf, frameCount: chunk)
        if inBuf.frameLength == 0 { break }
        let cap = AVAudioFrameCount(Double(inBuf.frameLength) * format.sampleRate / f.processingFormat.sampleRate) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { break }
        var given = false; var err: NSError?
        conv.convert(to: out, error: &err) { _, st in if given { st.pointee = .noDataNow; return nil }; given = true; st.pointee = .haveData; return inBuf }
        if err == nil, out.frameLength > 0 { cont.yield(AnalyzerInput(buffer: out)); self.fedFrames += Int64(out.frameLength) }
        if let ch = inBuf.floatChannelData?[0] { // 마이크와 같은 크기 판정을 탄다
          var sum: Float = 0
          for i in 0..<Int(inBuf.frameLength) { sum += ch[i] * ch[i] }
          self.noteLevel((sum / Float(inBuf.frameLength)).squareRoot(), seconds: Double(inBuf.frameLength) / f.processingFormat.sampleRate, aec: false)
        }
        try await Task.sleep(nanoseconds: UInt64(Double(inBuf.frameLength) / f.processingFormat.sampleRate * 1e9))
      }
      let n = AVAudioFrameCount(format.sampleRate * 0.1)
      for _ in 0..<Int(tail * 10) { // 무음 0.1초씩
        guard let z = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: n) else { break }
        z.frameLength = n
        cont.yield(AnalyzerInput(buffer: z)); self.fedFrames += Int64(n)
        self.noteLevel(0, seconds: 0.1, aec: false)
        try await Task.sleep(nanoseconds: 100_000_000)
      }
    } catch { fail("파일 흘려 넣기 실패: \(error.localizedDescription)") }
    emit(["type": "fed"])
  }

  // 시험용: 파일을 받아쓰고 끝나면 done
  func file(_ path: String, _ id: String, words: [String] = []) async {
    guard let t = await makeTranscriber(id) else { emit(["type": "done"]); return }
    do {
      let f = try AVAudioFile(forReading: URL(fileURLWithPath: path))
      let analyzer = SpeechAnalyzer(modules: [t])
      await hint(analyzer, words)
      let task = watch(t)
      if let last = try await analyzer.analyzeSequence(from: f) { try await analyzer.finalizeAndFinish(through: last) }
      else { await analyzer.cancelAndFinishNow() }
      _ = await task.value
    } catch { fail("파일 받아쓰기 실패: \(error.localizedDescription)") }
    emit(["type": "done"])
  }
}

// 맥 출력 음량(기본 출력 장치의 주 음량)을 dB 로 정확히 낮췄다 되돌린다. 눈금(0~100)은 dB 와 비례하지 않아서(56 → 14 가 −24dB였다) dB 로 다룬다.
// 줄여 둔 채로 이 헬퍼가 죽으면(강제 종료 등) 음량이 낮은 채로 남으니, 줄일 때 값을 파일에 적어 두고 다음에 뜰 때 되돌린다(recover).
final class OutputDuck {
  private var device = AudioObjectID(0), savedDb: Float32 = 0, setDb: Float32 = 0, active = false
  private let note = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".skinclaude/duck.json")
  private var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyVolumeDecibels, mScope: kAudioDevicePropertyScopeOutput, mElement: kAudioObjectPropertyElementMain)
  private static func defaultOutput() -> AudioObjectID {
    var dev = AudioObjectID(0); var size = UInt32(MemoryLayout<AudioObjectID>.size)
    var a = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &a, 0, nil, &size, &dev)
    return dev
  }
  private func read(_ dev: AudioObjectID) -> Float32? {
    var v: Float32 = 0; var s = UInt32(MemoryLayout<Float32>.size)
    return AudioObjectGetPropertyData(dev, &addr, 0, nil, &s, &v) == noErr ? v : nil
  }
  private func write(_ dev: AudioObjectID, _ v: Float32) -> Bool { var x = v; return AudioObjectSetPropertyData(dev, &addr, 0, nil, UInt32(MemoryLayout<Float32>.size), &x) == noErr }
  // 낮춘 양(dB)을 돌려준다. 못 낮추면 0(주 음량이 없는 장치 등)
  func duck(_ db: Float32) -> Float32 {
    if active { return savedDb - setDb }
    let dev = OutputDuck.defaultOutput()
    var settable: DarwinBoolean = false
    guard dev != 0, AudioObjectHasProperty(dev, &addr), AudioObjectIsPropertySettable(dev, &addr, &settable) == noErr, settable.boolValue,
          let cur = read(dev), write(dev, cur - db), let now = read(dev), cur - now > 0.5 else { return 0 }
    device = dev; savedDb = cur; setDb = now; active = true
    if let d = try? JSONSerialization.data(withJSONObject: ["device": Int(dev), "saved": Double(cur), "set": Double(now)]) { try? d.write(to: note) }
    return cur - now
  }
  // 지난번에 줄여 둔 채로 죽었으면 되돌린다(같은 장치이고 그 값 그대로일 때만)
  func recover() {
    guard let d = try? Data(contentsOf: note), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return }
    try? FileManager.default.removeItem(at: note)
    guard let dev = o["device"] as? Int, let saved = o["saved"] as? Double, let set = o["set"] as? Double,
          OutputDuck.defaultOutput() == AudioObjectID(dev), let cur = read(AudioObjectID(dev)), abs(cur - Float32(set)) < 0.6 else { return }
    if write(AudioObjectID(dev), Float32(saved)) { emit(["type": "info", "message": "지난번에 줄여 둔 맥 음량을 되돌림"]) }
  }
  func unduck() {
    guard active else { return }
    active = false
    try? FileManager.default.removeItem(at: note)
    // 같은 장치이고, 우리가 맞춰 둔 값 그대로일 때만 되돌린다(사용자가 그새 음량을 바꿨거나 이어폰을 꽂았으면 건드리지 않는다)
    guard OutputDuck.defaultOutput() == device, let cur = read(device), abs(cur - setDb) < 0.6 else { return }
    _ = write(device, savedDb)
  }
}
let outDuck = OutputDuck()
outDuck.recover()

// 강제로 꺼질 때(SIGTERM)도 줄여 둔 음량은 되돌린다
signal(SIGTERM, SIG_IGN)
let termSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
termSource.setEventHandler { outDuck.unduck(); exit(0) }
termSource.resume()

// 시험: sttd --aec-test mic.wav ref.wav out.wav [refs.wav] — 파일(16kHz 모노 16비트)을 실시간처럼 덩이로 넣어 에코 제거 결과를 쓴다
// (ref = 가운데 채널, refs = 옆 채널. 없으면 옆은 0)
if CommandLine.arguments.count >= 5, CommandLine.arguments[1] == "--aec-test" {
  func wav(_ path: String) -> [Float] {
    guard let d = try? Data(contentsOf: URL(fileURLWithPath: path)), d.count > 44 else { return [] }
    return d.subdata(in: 44..<d.count).withUnsafeBytes { raw in let p = raw.bindMemory(to: Int16.self); return (0..<p.count).map { Float(p[$0]) / 32768 } }
  }
  let mic = wav(CommandLine.arguments[2]), ref = wav(CommandLine.arguments[3])
  let refS = CommandLine.arguments.count >= 6 ? wav(CommandLine.arguments[5]) : [Float](repeating: 0, count: ref.count)
  let e = RefEcho()
  e.onInfo = { print("[info]", $0) }
  // 말 시작·끝 판정도 같이 돌린다(시각은 파일 속 시각). "말 시작 12.34" / "확정 당김 15.67" 줄로 찍는다
  let gate = Ear(), meter = SpeechBand()
  var simT = 0.0
  gate.clock = { simT }
  let env = ProcessInfo.processInfo.environment
  gate.testEnd(ms: Double(env["END_MS"] ?? "") ?? 1700, quickMs: Double(env["QUICK_MS"] ?? "") ?? 0, quickMax: Double(env["QUICK_MAX"] ?? "") ?? 1.3)
  var out: [Float] = [], ri = 0, mi = 0, was = false
  while mi < mic.count {
    let n = min(1365, mic.count - mi)
    while ri < ref.count && Double(ri + 160) / 16000 <= Double(mi + n) / 16000 - 0.01 {
      let m = min(160, ref.count - ri)
      ref.withUnsafeBufferPointer { a in refS.withUnsafeBufferPointer { b in e.pushRef([a.baseAddress! + ri, b.baseAddress! + min(ri, max(0, refS.count - m))], count: m, at: Double(ri) / 16000) } }
      ri += m
    }
    let (clean, est) = e.process(Array(mic[mi..<mi + n]), at: Double(mi) / 16000)
    let cold = e.cold
    meter.feed(clean, est) { lv, y in
      simT += Double(SpeechBand.block) / 16000
      gate.noteBand(e: lv, y: y, seconds: Double(SpeechBand.block) / 16000, cold: cold)
      if gate.inBurst && !was { print(String(format: "말 시작 %.2f", simT)) }
      if gate.endCheck() { print(String(format: "확정 당김 %.2f", simT)); gate.finalized() }
      else if was && !gate.inBurst { print(String(format: "말 끝(확정 없이) %.2f", simT)) }
      was = gate.inBurst
    }
    out.append(contentsOf: clean)
    mi += n
  }
  writeWav16(CommandLine.arguments[4], out)
  func rms(_ a: ArraySlice<Float>) -> Float { var x: Float = 0; for v in a { x += v * v }; return (x / Float(max(1, a.count))).squareRoot() }
  let line = (0..<(out.count / 16000)).map { String(format: "%.0f", 20 * log10(rms(mic[$0 * 16000..<($0 + 1) * 16000]) / max(1e-9, rms(out[$0 * 16000..<($0 + 1) * 16000])))) }.joined(separator: " ")
  print("초마다 줄어든 양(dB):", line)
  print(String(format: "지연 %.0fms · ERLE %.1fdB", e.delayMs, e.erleDb))
  exit(0)
}

let ear = Ear()
let outputs = OutputWatch()
outputs.onChange = { playing in ear.othersChanged(playing) }
outputs.onImmediate = { _ in ear.calibrate() }
Task {
  while let line = readLine() {
    guard let data = line.data(using: .utf8), let msg = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let cmd = msg["cmd"] as? String else { continue }
    let locale = (msg["locale"] as? String) ?? "ko_KR"
    let words = (msg["words"] as? [String]) ?? []
    switch cmd {
    case "start":
      await ear.start(locale, words: words, endMs: (msg["endMs"] as? Double) ?? 0, quickEndMs: (msg["quickEndMs"] as? Double) ?? 0, quickMaxSec: (msg["quickMaxSec"] as? Double) ?? 1.3,
                      fast: (msg["fast"] as? Bool) ?? false, aecMode: (msg["aec"] as? String) ?? "auto",
                      engine: (msg["engine"] as? String) ?? "speech")
      outputs.start(ignore: (msg["ignore"] as? [String]) ?? [])
    case "flush": await ear.flush()
    case "awake": ear.setAwake(until: (msg["until"] as? Double) ?? 0) // 이어 듣기 창(유예 포함)의 끝 — 그 밖에서만 짧은 말을 빨리 확정한다
    case "duck": emit(["type": "ducked", "db": Double(outDuck.duck(Float32((msg["db"] as? Double) ?? 10)))])
    case "unduck": outDuck.unduck()
    case "feed": Task { await ear.feed((msg["path"] as? String) ?? "", tail: (msg["tail"] as? Double) ?? 6) }
    case "pause": ear.paused = true
    case "resume": ear.resume()
    case "stop": outputs.stop(); await ear.stop()
    case "file": await ear.file((msg["path"] as? String) ?? "", locale, words: words)
    default: fail("모르는 명령: \(cmd)")
    }
  }
  outDuck.unduck() // 줄여 둔 채로 꺼지지 않게
  await ear.stop()
  exit(0)
}
RunLoop.main.run()
