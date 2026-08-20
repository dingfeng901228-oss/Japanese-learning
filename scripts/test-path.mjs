// One-shot test for the Japanese path readdir. Pure ASCII source to
// avoid the write-tool's UTF-8 mangle; Unicode escapes decode at
// runtime to 日语学习资料.

import { readdir, writeFile } from "node:fs/promises";

const dir =
  "F:\\" +
  "\u65e5\u8bed\u5b66\u4e60\u8d44\u6599" +
  "\\shadowin-motto_all (2)";

const lines = [];
lines.push("=== TEST 1: string literal with Unicode escapes ===");
lines.push("Path: " + dir);
lines.push("Path length: " + dir.length);
lines.push("Path bytes (hex): " + Buffer.from(dir, "utf-8").toString("hex"));

try {
  const entries = await readdir(dir);
  lines.push("RESULT: " + entries.length + " entries");
  lines.push("First 5: " + entries.slice(0, 5).join(", "));
} catch (e) {
  lines.push("ERROR: code=" + e.code);
  lines.push("ERROR: syscall=" + e.syscall);
  lines.push("ERROR: msg=" + e.message);
  lines.push("ERROR: pathArg=" + dir);
}

lines.push("");
lines.push("=== TEST 2: parent dir scan ===");
try {
  const parent = "F:\\";
  const parentEntries = await readdir(parent);
  lines.push("Parent " + parent + ": " + parentEntries.length + " entries");
  lines.push("Has 日语学习资料: " + parentEntries.includes("\u65e5\u8bed\u5b66\u4e60\u8d44\u6599"));
  lines.push("First 5: " + parentEntries.slice(0, 5).join(", "));
} catch (e) {
  lines.push("Parent scan ERROR: " + e.code + " " + e.message);
}

await writeFile("F:/WebSite/Japanese-learning-compare/scripts/test-result.txt", lines.join("\n"));
console.log(lines.join("\n"));
