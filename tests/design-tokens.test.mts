import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../src/app/redesign.css", import.meta.url),
  "utf8",
);

function themeBlock(pattern: RegExp) {
  const match = css.match(pattern);
  assert.ok(match?.[1], "theme token block is missing");
  return match[1];
}

function token(block: string, name: string) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"));
  assert.ok(match?.[1], `${name} is missing or is not a six-digit hex color`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((part) => Number.parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  assert.ok(channels?.length === 3, `invalid color: ${hex}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("all shelf tones keep the small index legible in both themes", () => {
  const blocks = [
    themeBlock(/:root,\s*:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/),
    themeBlock(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/),
  ];

  for (const block of blocks) {
    for (let index = 1; index <= 8; index += 1) {
      const ratio = contrast(
        token(block, `tone-${index}-bg`),
        token(block, `tone-${index}-fg`),
      );
      assert.ok(
        ratio >= 4.5,
        `tone ${index} contrast is only ${ratio.toFixed(2)}:1`,
      );
    }
  }
});

test("the home shelf keeps colored light-theme numbers and readable dark ones", () => {
  assert.match(
    css,
    /\.shelf-book-number\s*\{[\s\S]*?color:\s*var\(--book-fg,\s*var\(--nook-ink\)\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /:root\[data-theme="dark"\]\s+\.shelf-book-number[\s\S]*?color:\s*var\(--nook-ink\);/,
  );
  assert.doesNotMatch(css, /#4e6d60|#3f4654/i);
});
