const test = require("node:test");
const assert = require("node:assert/strict");
const { distanceMeters } = require("../cloudfunctions/cloud/project/utils/geo_util.js");

test("calculates location distance and rejects invalid coordinates", () => {
  assert.ok(distanceMeters(22.3193, 114.1694, 22.3193, 114.1694) < 1);
  assert.ok(distanceMeters(22.3193, 114.1694, 22.3203, 114.1694) > 100);
  assert.equal(distanceMeters("bad", 1, 2, 3), null);
});
