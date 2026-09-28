import assert from "node:assert/strict";
import { decodeLyricsEntities } from "./textEntities.ts";

const examples = [
  ["仿佛从未存在&nbsp;", "仿佛从未存在 "],
  ["甲&#160;乙&#xA0;丙\u00a0丁", "甲 乙 丙 丁"],
  ["A &amp; B &quot;C&quot; &#39;D&#39;", "A & B \"C\" 'D'"],
  ["&#x1F600;", "😀"],
  ["[00:01.00]译文&nbsp;\n[00:02.00]后续", "[00:01.00]译文 \n[00:02.00]后续"],
  ["&lt;script&gt;example&lt;/script&gt;", "<script>example</script>"],
  ["&amp;lt;", "&lt;"],
  ["&#0; &#10; &#xD800; &#x110000; &unknown;", "&#0; &#10; &#xD800; &#x110000; &unknown;"],
];
for (const [raw, decoded] of examples) assert.equal(decodeLyricsEntities(raw), decoded);
console.log("Lyrics text entities, Unicode bounds and timeline preservation verified.");
