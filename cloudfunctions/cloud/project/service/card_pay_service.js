/**
 * 微信支付（云开发 cloudPay）封装 —— 会员在线购卡走微信支付的那条路径。
 *
 * ⚠️ 使用前必读（怎么用）：
 * 1. 需要「微信支付商户号」并已在微信支付后台与云开发环境完成关联（云支付/cloudPay 能力）。
 *    小程序 appId、商户号 mchId、支付密钥 payKey 由微信支付后台申请。
 * 2. 把商户参数填到 config/config.js 的 WX_PAY（见该文件说明），或按租户存 ax_setup。
 *    未配置时 isEnabled() 返回 false，会员端自动只显示「线下付款」，不会报错。
 * 3. 支付回调：本服务约定回调走同一个云函数（functionName = 当前云函数名），
 *    在 index.js 入口处被 isPayNotify(event) 命中并交给 handlePayNotify() 处理。
 * 4. 本地/CI 无法真跑支付（需真机 + 商户号），代码在无配置时安全降级，可正常部署。
 *
 * 参考：微信云开发 cloud.cloudPay.unifiedOrder / 支付结果回调。
 */

const cloudBase = require("../../framework/cloud/cloud_base.js");
const config = require("../../config/config.js");
const timeUtil = require("../../framework/utils/time_util.js");

class CardPayService {
  /**
   * 读取支付配置。优先 config.WX_PAY；字段缺失即视为未启用。
   * 结构：{ mchId, payKey, functionName?, notifyUrlKey? }
   */
  static _getPayConfig() {
    const cfg = (config && config.WX_PAY) || {};
    return {
      mchId: cfg.mchId || "",
      payKey: cfg.payKey || "",
      // 回调云函数名：默认与业务云函数同名（回调打回自身）
      functionName: cfg.functionName || cfg.callbackFunction || "cloud",
      envId: cfg.envId || config.CLOUD_ID || "",
    };
  }

  /** 是否已具备微信支付能力（商户号 + 密钥齐全） */
  static isEnabled() {
    const c = CardPayService._getPayConfig();
    return !!(c.mchId && c.payKey);
  }

  /**
   * 统一下单，返回小程序 requestPayment 所需的支付参数。
   * @param {*} order   ax_card_order 订单对象（含 ORDER_ID / ORDER_PAY_FEE / ORDER_TPL_NAME）
   * @param {*} openId  下单会员 openid
   * @returns {payment} 可直接回传前端 wx.requestPayment 的对象
   */
  static async unifiedOrder(order, openId) {
    if (!CardPayService.isEnabled()) {
      throw new Error("PAY_DISABLED"); // 上层据此降级为线下
    }
    const c = CardPayService._getPayConfig();
    const cloud = cloudBase.getCloud();

    const totalFee = Number(order.ORDER_PAY_FEE) || 0; // 单位：分
    if (totalFee <= 0) throw new Error("订单金额无效");

    // 云支付统一下单。回调将以 event 形式打到 functionName 指定的云函数。
    const res = await cloud.cloudPay.unifiedOrder({
      body: (order.ORDER_TPL_NAME || "会员卡").slice(0, 40),
      outTradeNo: order.ORDER_ID, // 用业务订单号，回调据此定位订单
      spbillCreateIp: "127.0.0.1",
      subMchId: c.mchId,
      totalFee, // 分
      envId: c.envId,
      functionName: c.functionName, // 支付结果回调的云函数
      nonceStr: CardPayService._nonce(),
      tradeType: "JSAPI",
      openid: openId,
    });

    if (!res || res.returnCode !== "SUCCESS" || res.resultCode !== "SUCCESS") {
      throw new Error(
        "微信统一下单失败：" + ((res && (res.errCodeDes || res.returnMsg)) || "未知"),
      );
    }
    // cloudPay 已返回可直接用于 requestPayment 的 payment 结构
    return res.payment;
  }

  /**
   * 判断一个云函数 event 是否是微信支付结果回调。
   * cloudPay 回调 event 带 outTradeNo + resultCode 且无 route。
   */
  static isPayNotify(event) {
    return !!(
      event &&
      !event.route &&
      event.outTradeNo &&
      (event.resultCode !== undefined || event.returnCode !== undefined)
    );
  }

  /**
   * 解析回调，返回归一化结果，不做发卡（发卡由 CardPurchaseService 幂等处理）。
   * @returns {{ outTradeNo, success, transactionId, totalFee }}
   */
  static parseNotify(event) {
    const success =
      event.returnCode === "SUCCESS" && event.resultCode === "SUCCESS";
    return {
      outTradeNo: event.outTradeNo,
      success,
      transactionId: event.transactionId || "",
      totalFee: Number(event.totalFee) || 0, // 分
      payTime: timeUtil.time(),
    };
  }

  static _nonce() {
    // 无 Math.random 依赖的简单随机串（时间戳 + 计数）
    return (
      "n" +
      timeUtil.time() +
      String(Number(process.hrtime ? process.hrtime()[1] : 0)).slice(0, 6)
    );
  }
}

module.exports = CardPayService;
