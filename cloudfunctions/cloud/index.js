const application = require('./framework/core/application.js');
const CardPayService = require('./project/service/card_pay_service.js');
const CardNotifyService = require('./project/service/card_notify_service.js');
const CardOrderJobService = require('./project/service/card_order_job_service.js');

// 云函数入口函数
exports.main = async (event, context) => {
	// 定时触发器：微信平台按 config.json 的 triggers 定时调用，event.Type === 'Timer'。
	// 无 route/token/PID，不走 application.app，由各 Job 服务自建租户上下文跨租户处理。
	if (event && event.Type === 'Timer') {
		return await runTimerJob(event);
	}

	// 微信支付结果回调：微信平台直接调用本云函数，event 无 route/token。
	// 必须在进入需要鉴权的 application.app 之前拦截处理。
	if (CardPayService.isPayNotify(event)) {
		return await CardNotifyService.handle(event);
	}

	return await application.app(event, context);
}

// 定时任务分发。按 TriggerName 路由到具体 Job；未知触发器全量跑一遍已注册任务。
async function runTimerJob(event) {
	const name = (event && event.TriggerName) || '';
	const result = {};
	try {
		// 超时未支付的微信购卡订单自动关单
		result.closeTimeoutCardOrders = await CardOrderJobService.closeTimeoutOrders();
	} catch (err) {
		result.error = (err && err.message) || String(err);
		console.error('[TimerJob]', name, err);
	}
	return result;
}
