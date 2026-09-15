import { checkRelease } from "../src/lib/release/check.ts";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--url") {
  console.error(
    "Usage: npm run release:check -- --url https://deployment.example",
  );
  process.exitCode = 1;
} else {
  try {
    const checks = await checkRelease(args[1]);
    console.log(
      JSON.stringify(
        {
          scope:
            "Public routes and authentication boundary only; no login, model call, write or end-to-end validation",
          checks,
          passed: checks.every((c) => c.passed),
        },
        null,
        2,
      ),
    );
    if (checks.some((c) => !c.passed)) process.exitCode = 1;
  } catch {
    console.error("Invalid deployment origin; no request sent.");
    process.exitCode = 1;
  }
}
