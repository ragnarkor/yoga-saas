/**
 * Notes: 业务通用
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2020-11-14 07:48:00 
 */

const cacheHelper = require('../helper/cache_helper.js');
const setting = require('../setting/setting.js');  
const pageHelper = require('../helper/page_helper.js');
  
function getListCacheKey(key) {
	key = key.toUpperCase();
	const pid = pageHelper.getPID() || 'ONE';
	return pid + '_' + key + '_LIST';
}

function isCacheList(key) {
	if (setting.CACHE_IS_LIST)
		return cacheHelper.get(getListCacheKey(key));
	else
		return false;
}

function removeCacheList(key) {
	if (setting.CACHE_IS_LIST)
		cacheHelper.remove(getListCacheKey(key));
}

function setCacheList(key, time = setting.CACHE_LIST_TIME) {
	if (setting.CACHE_IS_LIST)
		cacheHelper.set(getListCacheKey(key), 'TRUE', time);
}


module.exports = {
	isCacheList,
	removeCacheList,
	setCacheList, 
}