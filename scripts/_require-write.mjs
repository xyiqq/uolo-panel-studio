// Imported first by one-off codemods that rewrite files under src/. Rerunning them
// regenerates hand-maintained sources and discards later edits, so require opt-in.
import path from "node:path";

if (!process.argv.includes("--write")) {
  const script = path.basename(process.argv[1] || "script");
  console.error(`${script} 会直接改写 src/ 下的源码，可能覆盖之后的手工修改。`);
  console.error(`确认工作区已提交或备份后，追加 --write 参数执行：node scripts/${script} --write`);
  process.exit(1);
}
