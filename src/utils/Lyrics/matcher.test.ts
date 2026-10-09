// 歌词元数据归一化测试（纯逻辑，无 Spicetify 依赖）。

import { normalizeTitle, splitArtists } from "./matcher.ts";

let failures = 0;
let passed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
  } else {
    failures++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

{
  check("normalizeTitle 大小写+标点", normalizeTitle("  Hello, World!  ") === "hello world");
  check("normalizeTitle 全角", normalizeTitle("ＦｕｌｌＷｉｄｔｈ") === "fullwidth");
  check("splitArtists feat", splitArtists("Jonah Paz feat. XXX").join(",") === "jonah paz,xxx");
  check("splitArtists 顿号", splitArtists("Jonah Paz, XXX、YYY").join(",") === "jonah paz,xxx,yyy");
  check("splitArtists 括号罗马音", splitArtists("少女時代 (SNSD)").join(",") === "少女時代");
}

console.log(`\n[lyrivaMusic Metadata] ${passed} passed, ${failures} failed`);

if (failures > 0) {
  (globalThis as any).process?.exit?.(1);
}
