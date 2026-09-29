import { defineConfig } from "@spicemod/creator";
import { ProjectArtifactName, ProjectVersion } from "./project/config";

export default defineConfig({
  name: ProjectArtifactName,
  version: ProjectVersion,
  framework: "react",
  linter: "oxlint",
  template: "extension",
  packageManager: "bun",
  cssId: "slstyles",
  devModeVarName: "__SLdev__m",
  esbuildOptions: {
    legalComments: "inline",
  },
});
