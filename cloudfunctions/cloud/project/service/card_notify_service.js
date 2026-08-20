/**
 * 微信支付结果回调处理（发卡自动触发）。
 *
 * 回调不走 application.app 的路由/鉴权链（微信平台调用，无 token、无 route），
 * 因此本服务被 index.js 在入口处直接调用，并自行建立租户上下文：
 *   1. 用 outTradeNo(=ORDER_ID) 跨租户查订单，取 _pid；
 *   2. 在该 _pid 的 tenantContext 里复用 AdminCardService.autoIssueByPay 幂等发卡。
 *
 * 回调可能被微信重放，全链路必须幂等：状态 CAS + USER_CARD_ORDER_ID 查重（见发卡核心）。
 */
const CardOrderModel = require("../model/card_order_model.js");
const AdminCardService = require("./admin/admin_card_service.js");
const CardPayService = require("./card_pay_service.js");
const tenantContext = require("../utils/tenant_context.js");

class CardNotifyService {
  /**
   * 处理一次支付回调 event。
   * @returns 微信要求的应答：{ errcode:0, errmsg:'ok' } 表示已确认收到，微信不再重推。
   */
  static async handle(event) {
    const notify = CardPayService.parseNotify(event);
    if (!notify.outTradeNo) {
      return { errcode: -1, errmsg: "缺少订单号" };
    }

    // 支付失败：记录但不发卡，仍应答 ok 以免微信反复重推
    if (!notify.success) {
      return { errcode: 0, errmsg: "ok" };
    }

    // 跨租户按订单号定位（mustPID=false），拿到订单所属租户
    let order = await CardOrderModel.getOne(
      { ORDER_ID: notify.outTradeNo },
      "ORDER_ID,_pid",
      {},
      false,
    );
    if (!order || !order._pid) {
      // 订单不存在：应答 ok，避免无限重推（属异常，记录即可）
      return { errcode: 0, errmsg: "ok" };
    }

    // 在订单所属租户上下文里发卡
    try {
      await tenantContext.runWithPID(order._pid, async () => {
        await new AdminCardService().autoIssueByPay(order.ORDER_ID, notify);
      });
      return { errcode: 0, errmsg: "ok" };
    } catch (err) {
      // 发卡失败已回滚为 PAID（钱已到），此处返回非 0 让微信稍后重推重试；
      // 若重推仍失败，馆主可在待办里人工补发。
      return { errcode: 1, errmsg: (err && err.message) || "发卡处理失败" };
    }
  }
}

module.exports = CardNotifyService;
