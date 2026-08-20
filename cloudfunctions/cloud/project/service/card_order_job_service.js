/**
 * 购卡订单定时维护（超时未支付自动关单）。
 *
 * 由定时触发器经 index.js 分发调用（无 route/无 token/无 PID）。
 * 跨租户扫描：微信支付订单在 PENDING（待支付）停留超过 TIMEOUT_MS 即自动关闭，
 * 释放防重占用、清理脏数据。
 *
 * 只关「微信 + PENDING」：
 *   - 线下订单的 PENDING = 待馆主人工确认，不能自动关（可能会员已线下付款）；
 *   - 微信订单一旦 PAID/CONFIRMING/ISSUED 就不在扫描范围（状态已推进）。
 *
 * 关单用 CAS（edit 返回受影响行数），与支付回调并发安全：
 *   若此刻回调正好把订单推进到 PAID，CAS 抢不到，不会误关已付款订单。
 */
const CardOrderModel = require("../model/card_order_model.js");
const timeUtil = require("../../framework/utils/time_util.js");
const tenantContext = require("../utils/tenant_context.js");

// 未支付超时时长（毫秒）。微信 JSAPI 下单默认 2 小时有效，取 2 小时对齐：
// 订单失效后无法再支付，故「关单后又到账」几乎不会发生。
// 若未来缩短超时或出现该边界（关单后收到支付），autoIssueByPay 会因订单 CLOSED
// 拒绝发卡——这属于「已收款未发卡」，需由后续【退款功能】兜底，不在本任务范围。
const TIMEOUT_MS = 2 * 60 * 60 * 1000;
// 单次任务最多处理多少单，防止极端情况下超时；剩余留给下一次任务。
const BATCH_LIMIT = 200;

class CardOrderJobService {
  /**
   * 关闭所有超时未支付的微信订单。
   * @returns {{ scanned:number, closed:number }}
   */
  static async closeTimeoutOrders() {
    const now = timeUtil.time(); // 毫秒
    const deadline = now - TIMEOUT_MS;

    // 跨租户查询（mustPID=false）：微信 + 待支付 + 下单时间早于截止线
    let list = await CardOrderModel.getAll(
      {
        ORDER_PAY_TYPE: CardOrderModel.PAY_TYPE.WECHAT,
        ORDER_STATUS: CardOrderModel.STATUS.PENDING,
        ORDER_ADD_TIME: ["<", deadline],
      },
      "ORDER_ID,_pid",
      { ORDER_ADD_TIME: "asc" },
      BATCH_LIMIT,
      false,
    );
    list = list || [];

    let closed = 0;
    for (const order of list) {
      if (!order._pid) continue;
      // 在订单所属租户上下文里 CAS 关单
      const ok = await tenantContext.runWithPID(order._pid, async () => {
        const updated = await CardOrderModel.edit(
          {
            ORDER_ID: order.ORDER_ID,
            ORDER_STATUS: CardOrderModel.STATUS.PENDING,
          },
          {
            ORDER_STATUS: CardOrderModel.STATUS.CLOSED,
            ORDER_CLOSE_REASON: "超时未支付，系统自动关闭",
            ORDER_EDIT_TIME: timeUtil.time(),
          },
        );
        return !!updated;
      });
      if (ok) closed++;
    }

    return { scanned: list.length, closed };
  }
}

module.exports = CardOrderJobService;
