const cloudHelper = require("../../../../helper/cloud_helper.js");
const pageHelper = require("../../../../helper/page_helper.js");
const timeHelper = require("../../../../helper/time_helper.js");
const themeHelper = require("../../../../helper/theme_helper.js");
const themeBh = require("../../../../behavior/theme_bh.js");
const cardFaceHelper = require("../../../../helper/card_face_helper.js");

// 状态机：PENDING(1) PAID(8) CONFIRMING(5) ISSUED(10) CLOSED(20) REFUNDING(15) REFUNDED(25)
// offline: PENDING(待馆方确认) → CONFIRMING → ISSUED / CLOSED
// wechat:  PENDING(待支付)     → PAID(已付未发卡) → CONFIRMING → ISSUED / CLOSED
const STATUS_META = {
  pending_wechat: { desc: "待支付", tone: "warn" },
  pending_offline: { desc: "待馆方确认", tone: "info" },
  paid: { desc: "已支付 · 发卡中", tone: "info" },
  confirming: { desc: "发卡处理中", tone: "info" },
  issued: { desc: "已发卡", tone: "ok" },
  closed: { desc: "已关闭", tone: "muted" },
  refunding: { desc: "退款中", tone: "warn" },
  refunded: { desc: "已退款", tone: "muted" },
};

const TABS = [
  { key: "all", name: "全部" },
  { key: "unpaid", name: "待支付" },
  { key: "doing", name: "进行中" },
  { key: "done", name: "已完成" },
];

Page({
  behaviors: [themeBh],

  data: {
    loading: true,
    list: [],
    showList: [],
    tabs: TABS,
    activeTab: "all",
    themeColor: pageHelper.getThemeColor(),
    pageStyle: themeHelper.getPageMetaStyle(pageHelper.getThemeColor()),
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const r = await cloudHelper.callCloudData(
        "my/card_order_list",
        {},
        { hint: false },
      );
      const list = ((r && r.list) || []).map((o) => this._decorate(o));
      this.setData({ loading: false, list });
    } catch (e) {
      this.setData({ loading: false, list: [] });
      console.error(e);
    }
    this._refreshShow();
  },

  _decorate(o) {
    const status = Number(o.ORDER_STATUS) || 0;
    const payType = o.ORDER_PAY_TYPE || "offline";
    let key = "closed";
    if (status === 1)
      key = payType === "wechat" ? "pending_wechat" : "pending_offline";
    else if (status === 8) key = "paid";
    else if (status === 5) key = "confirming";
    else if (status === 10) key = "issued";
    else if (status === 20) key = "closed";
    else if (status === 15) key = "refunding";
    else if (status === 25) key = "refunded";
    const meta = STATUS_META[key] || { desc: "未知状态", tone: "muted" };
    const transferProof = o.ORDER_TRANSFER_PROOF || "";
    const transferAccount = o.ORDER_TRANSFER_ACCOUNT || {};
    const offlinePending = status === 1 && payType === "offline";

    const snapshot = o.ORDER_TPL_SNAPSHOT || {};
    return {
      id: o.ORDER_ID,
      sn: o.ORDER_ID,
      name: o.ORDER_TPL_NAME || snapshot.name || "会员卡套餐",
      status,
      payType,
      payTypeDesc: payType === "wechat" ? "微信支付" : "线下付款",
      statusDesc: meta.desc,
      statusTone: meta.tone,
      tab: this._tabOf(status, payType),
      payYuan: this._yuan(Number(o.ORDER_PAY_FEE) || 0),
      timeText: timeHelper.timestamp2Time(o.ORDER_ADD_TIME, "Y-M-D h:m"),
      guide: o.ORDER_PAY_GUIDE || "",
      coverUrl: cardFaceHelper.getCoverUrl(snapshot.cover || ""),
      color: snapshot.color || "#5b8a72",
      colorDark: this._darken(snapshot.color || "#5b8a72"),
      typeDesc: snapshot.type === "times" ? "次数卡" : "期限卡",
      mainAttr:
        snapshot.type === "times"
          ? `${snapshot.quota || "-"} 次 · 有效期 ${snapshot.days || "-"} 天`
          : `有效期 ${snapshot.days || "-"} 天`,
      showGuide: status === 1 && payType === "offline" && !!o.ORDER_PAY_GUIDE,
      isOfflinePending: offlinePending,
      transferProof,
      transferReference: o.ORDER_TRANSFER_REFERENCE || "",
      transferAccount,
      hasTransferAccount: !!(
        transferAccount.receiver ||
        transferAccount.bank ||
        transferAccount.account
      ),
      transferStatusText: transferProof
        ? "已上传凭证，等待馆方核对"
        : "请完成转账后上传凭证",
      canUploadProof: offlinePending,
      canPay: status === 1 && payType === "wechat",
    };
  },

  _tabOf(status, payType) {
    if (status === 1 && payType === "wechat") return "unpaid";
    if (status === 10 || status === 25 || status === 20) return "done";
    return "doing";
  },

  _refreshShow() {
    const tab = this.data.activeTab;
    const showList =
      tab === "all"
        ? this.data.list
        : this.data.list.filter((it) => it.tab === tab);
    this.setData({ showList });
  },

  bindTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this._refreshShow();
  },

  async bindRepayTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((it) => it.id === id);
    if (!id || !item || !item.canPay || this._paying) return;
    this._paying = true;
    try {
      const r = await cloudHelper.callCloudSumbit(
        "my/card_order_repay",
        { orderId: id },
        { title: "发起支付" },
      );
      if (r && r.payment) return this._pay(r.payment);
      this._paying = false;
    } catch (err) {
      this._paying = false;
      console.error(err);
    }
  },

  _pay(payment) {
    wx.requestPayment(
      Object.assign({}, payment, {
        success: () => {
          this._paying = false;
          wx.showToast({ title: "支付成功", icon: "success" });
          setTimeout(() => this.load(), 800);
        },
        fail: (err) => {
          this._paying = false;
          const canceled =
            err && err.errMsg && err.errMsg.indexOf("cancel") >= 0;
          wx.showToast({
            title: canceled ? "已取消支付" : "支付未完成",
            icon: "none",
          });
        },
      }),
    );
  },

  bindCopySnTap(e) {
    const sn = e.currentTarget.dataset.sn || "";
    if (!sn) return;
    wx.setClipboardData({
      data: String(sn),
      success: () => wx.showToast({ title: "订单号已复制", icon: "success" }),
    });
  },

  bindCopyAccountTap(e) {
    const account = e.currentTarget.dataset.account || "";
    if (!account) return;
    wx.setClipboardData({
      data: account,
      success: () => wx.showToast({ title: "账号已复制", icon: "success" }),
    });
  },

  bindPreviewProofTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url], current: url });
  },

  bindUploadProofTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || this._uploadingOrderId) return;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const path = res.tempFilePaths && res.tempFilePaths[0];
        if (!path) return;
        wx.showModal({
          title: "提交转账凭证",
          editable: true,
          placeholderText: "转账流水号或备注（选填）",
          success: (modal) => {
            if (!modal.confirm) return;
            this._submitTransferProof(id, path, modal.content || "");
          },
        });
      },
    });
  },

  async _submitTransferProof(orderId, tempPath, reference) {
    this._uploadingOrderId = orderId;
    try {
      wx.showLoading({ title: "上传凭证中", mask: true });
      const proof = await cloudHelper.transTempPicOne(
        tempPath,
        "card_order/transfer",
        orderId,
      );
      if (!proof || typeof proof !== "string") throw new Error("凭证上传失败");
      await cloudHelper.callCloudSumbit(
        "my/card_order_transfer_submit",
        { orderId, proof, reference },
        { hint: false },
      );
      wx.showToast({ title: "凭证已提交", icon: "success" });
      await this.load();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: "提交失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
      this._uploadingOrderId = "";
    }
  },

  _yuan(fee) {
    return (fee / 100)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1");
  },

  _darken(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 255) * 0.72);
    const g = Math.round(((n >> 8) & 255) * 0.72);
    const b = Math.round((n & 255) * 0.72);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },
});
