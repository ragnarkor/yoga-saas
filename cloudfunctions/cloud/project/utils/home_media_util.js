/** 将云存储临时地址结果还原为与输入顺序一致的纯字符串数组。 */
function mergeResolvedMediaUrls(sourceUrls, tempFiles) {
  const urlMap = new Map();
  for (const item of tempFiles || []) {
    if (!item || !item.cloudId) continue;
    urlMap.set(item.cloudId, item.url || item.cloudId);
  }
  return (sourceUrls || []).map((source) => urlMap.get(source) || source || "");
}

module.exports = { mergeResolvedMediaUrls };
