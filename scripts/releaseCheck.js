import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export function buildReleasePlan({
  live = false,
  frontendDirectory,
  productionEnvironmentFile = ".env.production.example",
} = {}) {
  const checks = [
    {
      label: "Production configuration",
      command: process.execPath,
      args: ["scripts/validateProductionEnv.js", productionEnvironmentFile],
    },
    {
      label: "JavaScript syntax",
      command: process.execPath,
      args: ["scripts/validateSyntax.js"],
    },
    {
      label: "Git whitespace",
      command: "git",
      args: ["diff", "--check"],
    },
    {
      label: "Portfolio content",
      command: npmCommand,
      args: ["run", "content:validate"],
    },
    {
      label: "Retrieval evaluation fixtures",
      command: npmCommand,
      args: ["run", "evals:validate"],
    },
    {
      label: "Answer evaluation fixtures",
      command: npmCommand,
      args: ["run", "evals:answers:validate"],
    },
    {
      label: "Conversation evaluation fixtures",
      command: npmCommand,
      args: ["run", "evals:conversation:validate"],
    },
    {
      label: "Automated tests",
      command: npmCommand,
      args: ["test"],
    },
  ];

  if (live) {
    checks.push(
      {
        label: "Live Pinecone retrieval evaluation",
        command: npmCommand,
        args: ["run", "evals:retrieval"],
        external: true,
      },
      {
        label: "Live OpenAI answer evaluation",
        command: npmCommand,
        args: ["run", "evals:answers"],
        external: true,
      },
      {
        label: "Live multi-turn evaluation",
        command: npmCommand,
        args: ["run", "evals:conversation"],
        external: true,
      },
    );
  }

  if (frontendDirectory) {
    checks.push({
      label: "Frontend production build",
      command: npmCommand,
      args: ["run", "build"],
      cwd: path.resolve(frontendDirectory),
    });
  }

  return checks;
}

function runCheck(check, root) {
  console.log(`\n[release:check] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd ?? root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${check.label} failed with exit code ${result.status}.`);
  }
}

export function runReleaseChecks({
  live = false,
  frontendDirectory = process.env.RELEASE_FRONTEND_DIR,
  productionEnvironmentFile =
    process.env.RELEASE_ENV_FILE ?? ".env.production.example",
  root = process.cwd(),
} = {}) {
  if (frontendDirectory) {
    const frontendPackage = path.join(
      path.resolve(frontendDirectory),
      "package.json",
    );
    if (!fs.existsSync(frontendPackage)) {
      throw new Error(
        `RELEASE_FRONTEND_DIR does not contain package.json: ${frontendDirectory}`,
      );
    }
  }

  const plan = buildReleasePlan({
    live,
    frontendDirectory,
    productionEnvironmentFile,
  });

  for (const check of plan) runCheck(check, root);

  if (!live) {
    console.log(
      "\n[release:check] Live RAG evaluations skipped. Use --live only when external API usage is authorized.",
    );
  }
  if (!frontendDirectory) {
    console.log(
      "[release:check] Frontend build skipped because RELEASE_FRONTEND_DIR is not configured.",
    );
  }
  console.log("\n[release:check] All configured checks passed.");
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    runReleaseChecks({ live: process.argv.includes("--live") });
  } catch (error) {
    console.error(`\n[release:check] ${error.message}`);
    process.exitCode = 1;
  }
}
