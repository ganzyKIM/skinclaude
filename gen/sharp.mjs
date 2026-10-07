// 이미지 도구들이 쓰는 sharp 를 어디서 가져올지. 이 프로젝트엔 sharp 가 없고 옆의 txtgame 프로젝트 것을 빌려 쓴다.
// 다른 자리에 있으면 SKINCLAUDE_SHARP_PKG=/path/to/package.json 으로 알려 준다.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const cands = [process.env.SKINCLAUDE_SHARP_PKG, path.join(os.homedir(), 'Desktop/txtgame/package.json'), new URL('../overlay/package.json', import.meta.url).pathname].filter(Boolean);
let sharp = null;
for (const pkg of cands) { try { if (fs.existsSync(pkg)) { sharp = createRequire(pkg)('sharp'); break; } } catch {} }
if (!sharp) throw new Error(`sharp 를 못 찾음 — SKINCLAUDE_SHARP_PKG 에 sharp 가 설치된 프로젝트의 package.json 경로를 주세요(본 것: ${cands.join(', ')})`);
export default sharp;
