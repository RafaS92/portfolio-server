import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(root, "src");
const allowedDependencies = new Map([
  ["platform", new Set(["platform"])],
  ["portfolio", new Set(["platform", "portfolio"])],
  ["chat", new Set(["platform", "portfolio", "chat"])],
  ["http", new Set(["platform", "chat", "http"])],
  ["evaluation", new Set(["platform", "portfolio", "chat", "evaluation"])],
]);
const importPattern = /(?:from\s+|import\s*\()(["'])(\.{1,2}\/[^"']+)\1/g;

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

function getLayer(file) {
  return path.relative(sourceRoot, file).split(path.sep)[0];
}

function getImports(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(importPattern)]
    .map((match) => path.resolve(path.dirname(file), match[2]))
    .filter((dependency) => dependency.startsWith(sourceRoot));
}

test("source folders contain cohesive modules rather than a single file", () => {
  const sourceDirectories = fs.readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sourceRoot, entry.name));

  for (const directory of sourceDirectories) {
    const modules = fs.readdirSync(directory)
      .filter((entry) => entry.endsWith(".js"));
    assert.ok(
      modules.length >= 2,
      `${path.relative(root, directory)} must contain at least two modules`,
    );
  }
});

test("feature modules follow the documented dependency direction", () => {
  const files = collectJavaScriptFiles(sourceRoot);

  for (const file of files) {
    const sourceLayer = getLayer(file);
    const allowed = allowedDependencies.get(sourceLayer);
    assert.ok(allowed, `Unknown source layer: ${sourceLayer}`);

    for (const dependency of getImports(file)) {
      const dependencyLayer = getLayer(dependency);
      assert.ok(
        allowed.has(dependencyLayer),
        `${path.relative(root, file)} cannot import ${path.relative(root, dependency)}`,
      );
    }
  }
});

test("source module graph has no circular dependencies", () => {
  const files = collectJavaScriptFiles(sourceRoot);
  const sourceFiles = new Set(files);
  const graph = new Map(
    files.map((file) => [
      file,
      getImports(file)
        .map((dependency) => dependency.endsWith(".js") ? dependency : `${dependency}.js`)
        .filter((dependency) => sourceFiles.has(dependency)),
    ]),
  );
  const visiting = new Set();
  const visited = new Set();

  function visit(file, ancestors = []) {
    if (visiting.has(file)) {
      const cycle = [...ancestors, file]
        .map((entry) => path.relative(root, entry))
        .join(" -> ");
      assert.fail(`Circular dependency found: ${cycle}`);
    }
    if (visited.has(file)) return;

    visiting.add(file);
    for (const dependency of graph.get(file) ?? []) {
      visit(dependency, [...ancestors, file]);
    }
    visiting.delete(file);
    visited.add(file);
  }

  for (const file of files) visit(file);
});
