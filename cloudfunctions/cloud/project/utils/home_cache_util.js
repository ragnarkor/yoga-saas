/**
 * 首页接口缓存键
 */
const cacheUtil = require("../../framework/utils/cache_util.js");
const config = require("../../config/config.js");

const CACHE_HOME_INDEX = "cache_home_index";
const CACHE_SETUP_ALL = "cache_setup_all";
const inFlight = new Map();

function _pidKey(pid) {
  return String(pid || global.PID || "default");
}

function homeIndexKey(pid) {
  return `${CACHE_HOME_INDEX}_${_pidKey(pid)}`;
}

function setupAllKey(pid) {
  return `${CACHE_SETUP_ALL}_${_pidKey(pid)}`;
}

async function _getOrLoad(key, fetcher) {
  const cached = await cacheUtil.get(key);
  if (cached) return cached;
  // 同一租户的并发冷启动只允许一个请求查库，避免首页缓存击穿。
  if (inFlight.has(key)) return inFlight.get(key);
  const pending = Promise.resolve().then(fetcher).then(async (data) => {
    await cacheUtil.set(key, data, config.CACHE_HOME_TIME || 600);
    return data;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

async function getHomeIndex(fetcher) {
  const key = homeIndexKey();
  return _getOrLoad(key, fetcher);
}

async function getSetupAll(fetcher) {
  const key = setupAllKey();
  return _getOrLoad(key, fetcher);
}

async function invalidateHomeCache(pid) {
  const targetPid = _pidKey(pid);
  await cacheUtil.remove(homeIndexKey(targetPid));
  await cacheUtil.remove(setupAllKey(targetPid));
}

module.exports = {
  getHomeIndex,
  getSetupAll,
  invalidateHomeCache,
};
