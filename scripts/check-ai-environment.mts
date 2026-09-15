import { checkAIEnvironment } from "../src/lib/release/environment.ts";
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--require-enabled")) {
  console.error("Usage: npm run release:env -- [--require-enabled]");
  process.exitCode = 1;
} else {
  const result = checkAIEnvironment(process.env);
  console.log(JSON.stringify(result, null, 2));
  if (
    !(args.includes("--require-enabled")
      ? result.readyForLiveTest
      : result.configured)
  )
    process.exitCode = 1;
}
