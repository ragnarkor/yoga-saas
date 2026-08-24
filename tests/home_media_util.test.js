const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mergeResolvedMediaUrls,
} = require("../cloudfunctions/cloud/project/utils/home_media_util.js");

test("将云文件临时地址对象转换为图片字符串", () => {
  const sources = ["cloud://a.jpg", "https://example.com/b.jpg", "cloud://c.jpg"];
  const resolved = mergeResolvedMediaUrls(sources, [
    { cloudId: "cloud://c.jpg", url: "https://cdn.example.com/c.jpg" },
    { cloudId: "cloud://a.jpg", url: "https://cdn.example.com/a.jpg" },
  ]);
  assert.deepEqual(resolved, [
    "https://cdn.example.com/a.jpg",
    "https://example.com/b.jpg",
    "https://cdn.example.com/c.jpg",
  ]);
});

test("临时地址缺失时保留原始云文件地址", () => {
  assert.deepEqual(mergeResolvedMediaUrls(["cloud://missing.jpg"], []), [
    "cloud://missing.jpg",
  ]);
});
