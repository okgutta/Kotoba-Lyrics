/// <reference types="node" />
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ProjectArtifactName, ProjectName } from "../../project/config.ts";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
assert.equal(ProjectArtifactName, "kotoba-lyrics");
assert.equal(manifest.name, ProjectName);
assert.equal(manifest.name, "Kotoba Lyrics");
assert.equal(
  manifest.main,
  `https://github.com/okgutta/Kotoba-Lyrics/releases/latest/download/${ProjectArtifactName}.js`
);
assert.ok(manifest.tags.includes("kotoba-lyrics"));
assert.ok(manifest.tags.includes("kotoba"));
console.log("Installer filename and Marketplace name/download contract verified");
