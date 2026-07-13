/**
 * 首页接口缓存键
 */
const cacheUtil = require("../../framework/utils/cache_util.js");
const config = require("../../config/config.js");

const CACHE_HOME_INDEX = "cache_home_index";
const CACHE_SETUP_ALL = "cache_setup_all";

function _pidKey() {
  return global.PID || "default";
}

function homeIndexKey() {
  return `${CACHE_HOME_INDEX}_${_pidKey()}`;
}

function setupAllKey() {
  return `${CACHE_SETUP_ALL}_${_pidKey()}`;
}

async function getHomeIndex(fetcher) {
  const key = homeIndexKey();
  const cached = await cacheUtil.get(key);
  if (cached) return cached;
  const data = await fetcher();
  await cacheUtil.set(key, data, config.CACHE_HOME_TIME || 600);
  return data;
}

async function getSetupAll(fetcher) {
  const key = setupAllKey();
  const cached = await cacheUtil.get(key);
  if (cached) return cached;
  const data = await fetcher();
  await cacheUtil.set(key, data, config.CACHE_HOME_TIME || 600);
  return data;
}

async function invalidateHomeCache() {
  await cacheUtil.remove(homeIndexKey());
  await cacheUtil.remove(setupAllKey());
}

module.exports = {
  getHomeIndex,
  getSetupAll,
  invalidateHomeCache,
};
