/// <reference types="node" />
import assert from "node:assert/strict";
import { parseStoredPolicy, policyState } from "./policy.ts";
import { buildUpdatePolicy, LOADER_VERSION } from "../../scripts/update-policy.mjs";

const policy = {
  latestVersion: "2.1.0",
  minimumSupportedVersion: "2.0.0",
  updateReason: "旧接口已停用",
};
assert.deepEqual(parseStoredPolicy(policy), policy);
assert.equal(policyState(policy, "1.9.9").updateRequired, true);
assert.equal(policyState(policy, "2.0.0").updateRequired, false);
assert.equal(
  policyState(policy, "2.2.0").latestVersion,
  undefined,
  "Do not advertise a cached older release"
);
for (const invalid of [
  null,
  [],
  {},
  { ...policy, minimumSupportedVersion: "2.2.0" },
  { ...policy, latestVersion: "v2.1.0" },
  { ...policy, updateReason: 12 },
]) {
  assert.equal(parseStoredPolicy(invalid), undefined);
}
assert.equal(LOADER_VERSION, 2);
assert.deepEqual(buildUpdatePolicy({ minimumSupportedVersion: null, reason: "" }, "2.1.0"), {});
assert.deepEqual(
  buildUpdatePolicy({ minimumSupportedVersion: "2.0.0", reason: "  旧接口已停用  " }, "2.1.0"),
  { minimumSupportedVersion: "2.0.0", updateReason: "旧接口已停用" }
);
for (const config of [
  null,
  [],
  { minimumSupportedVersion: "2.2.0", reason: "x" },
  { minimumSupportedVersion: "2.0.0", reason: "  " },
  { minimumSupportedVersion: "v2.0.0", reason: "x" },
]) {
  assert.throws(() => buildUpdatePolicy(config, "2.1.0"));
}
console.log("Update policy tests passed");
