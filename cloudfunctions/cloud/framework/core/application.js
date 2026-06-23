/**
 * Notes: 云函数业务主逻辑
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2020-09-05 04:00:00 
 */
const util = require('../utils/util.js');
const cloudBase = require('../cloud/cloud_base.js');
const timeUtil = require('../utils/time_util.js');
const appUtil = require('./app_util.js');
const appCode = require('./app_code.js');
const appOther = require('./app_other.js');
const config = require('../../config/config.js');
const routes = require('config/route.js');

async function app(event, context) {

	// 非标业务处理
	let {
		eventX,
		isOther
	} = appOther.handlerOther(event);
	event = eventX;

	// 取得openid
	const cloud = cloudBase.getCloud();
	const wxContext = cloud.getWXContext();
	let r = '';
	try {

		if (!util.isDefined(event.route)) {
			showEvent(event);
			console.error('Route Not Defined');
			return appUtil.handlerSvrErr();
		}

		r = event.route.toLowerCase();
		if (!r.includes('/')) {
			showEvent(event);
			console.error('Route Format error[' + r + ']');
			return appUtil.handlerSvrErr();
		}

		// 路由不存在
		if (!util.isDefined(routes[r])) {
			showEvent(event);
			console.error('Route [' + r + '] Is Not Exist');
			return appUtil.handlerSvrErr();
		}

		let routesArr = routes[r].split('@');

		let controllerName = routesArr[0];
		let actionName = routesArr[1];

		// 事前处理
		if (actionName.includes('#')) {
			let actionNameArr = actionName.split('#');
			actionName = actionNameArr[0];
			if (actionNameArr[1] && config.IS_DEMO) {
				console.log('###演示版事前处理, APP Before = ' + actionNameArr[1]);
				return beforeApp(actionNameArr[1]);
			}
		}

		console.log('');
		console.log('');
		let time = timeUtil.time('Y-M-D h:m:s');
		let timeTicks = timeUtil.time();
		let openId = wxContext.OPENID;

		console.log('▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤▤');
		console.log(`【↘${time} ENV (${config.CLOUD_ID})】【Request Base↘↘↘】\n【↘Route =***${r}】\n【↘Controller = ${controllerName}】\n【↘Action = ${actionName}】\n【↘OPENID = ${openId}】`);



		// 引入逻辑controller 
		controllerName = controllerName.toLowerCase().trim();
		const ControllerClass = require('project/controller/' + controllerName + '.js');
		const controller = new ControllerClass(r, openId, event);

		// 读接口跳过 initSetup，避免每次请求多轮数据库探测拖慢响应
		const FAST_ROUTES = {
			'home/index': 1,
			'home/teacher_home': 1,
			'home/teacher_detail': 1,
			'tenant/list': 1,
			'tenant/detail': 1,
			'passport/my_detail': 1,
			'passport/my_tenants': 1,
			'passport/sync_profile': 1,
			'my/my_join_someday': 1,
			'my/my_join_list': 1,
			'my/my_join_detail': 1,
			'admin/home': 1,
			'admin/wx_session': 1,
			'admin/wx_bind': 1,
			'admin/wx_tenant_list': 1,
			'admin/wx_unbind': 1,
			'admin/bind_admin_list': 1,
		};
		if (!FAST_ROUTES[r]) {
			await controller['initSetup']();
		}

		let result = await controller[actionName]();

		// 返回值处理
		if (isOther) {
			// 非标处理
			return result;
		} else {
			if (!result)
				result = appUtil.handlerSucc(r); // 无数据返回
			else
				result = appUtil.handlerData(result, r); // 有数据返回
		}


		console.log('------');
		time = timeUtil.time('Y-M-D h:m:s');
		timeTicks = timeUtil.time() - timeTicks;
		console.log(`【${time}】【Return Base↗↗↗】\n【↗Route =***${r}】\n【↗Duration = ${timeTicks}ms】\n【↗↗OUT DATA】= `, result);
		console.log('▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦');
		console.log('');
		console.log('');

		return result;


	} catch (ex) {
		const log = cloud.logger();

		console.log('------');
		time = timeUtil.time('Y-M-D h:m:s');
		console.error(`【${time}】【Return Base↗↗↗】\n【↗Route = ${r}】\Exception MSG = ${ex.message}, CODE=${ex.code}`);

		// 系统级错误定位调试
		if (config.TEST_MODE && ex.name != 'AppError') throw ex;

		console.log('▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦');
		console.log('');
		console.log('');

		if (ex.name == 'AppError') {
			log.warn({
				route: r,
				errCode: ex.code,
				errMsg: ex.message
			});
			// 自定义error处理
			return appUtil.handlerAppErr(ex.message, ex.code);
		} else {
			//console.log(ex); 
			log.error({
				route: r,
				errCode: ex.code,
				errMsg: ex.message,
				errStack: ex.stack
			});


			// 系统error
			return appUtil.handlerSvrErr();
		}
	}
}

// 事前处理
function beforeApp(method) {
	switch (method) {
		case 'noDemo': {
			return appUtil.handlerAppErr('本系统仅为客户体验演示，后台提交的操作均不生效！如有需要请联系作者微信cclinux0730', appCode.LOGIC);
		}
	}
	console.error('事前处理, Method Not Find = ' + method);
}

// 展示当前输入数据
function showEvent(event) {
	console.log(event);
}

module.exports = {
	app
}