const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

// 与后端 CardOrderModel.STATUS 对齐
const STATUS = {
  PENDING: 1,
  PAID: 8,
  CONFIRMING: 5,
  ISSUED: 10,
  REFUNDING: 15,
  CLOSED: 20,
  REFUNDED: 25,
};

// 顶部筛选：待处理（PENDING+PAID 分别拉再合并太重，这里默认展示待确认）
const TABS = [
  { key: 'todo', label: '待处理', status: STATUS.PENDING },
  { key: 'paid', label: '已付待发', status: STATUS.PAID },
  { key: 'issued', label: '已发卡', status: STATUS.ISSUED },
  { key: 'refunded', label: '已退款', status: STATUS.REFUNDED },
  { key: 'closed', label: '已关闭', status: STATUS.CLOSED },
  { key: 'all', label: '全部', status: '' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    tabs: TABS.map((t) => ({ key: t.key, label: t.label })),
    activeTab: 'todo',
    orders: [],
    loading: true,
    total: 0,
  },

  onLoad() {
    this._applyCoachTheme();
    this._load();
  },

  onPullDownRefresh() {
    this._load().finally(() => wx.stopPullDownRefresh());
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._load();
  },

  bindTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this._load();
  },

  _currentStatus() {
    const tab = TABS.find((t) => t.key === this.data.activeTab) || TABS[0];
    return tab.status;
  },

  async _load() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return this.setData({ loading: false });

    this.setData({ loading: true });
    try {
      const params = { page: 1, size: 100 };
      const status = this._currentStatus();
      if (status !== '') params.status = status;

      const res = await cloudHelper.callCloudData(
        'admin/card_order_list',
        params,
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      const orders = list.map((o) => ({
        id: o.ORDER_ID,
        userName: o.ORDER_USER_NAME || '会员',
        tplName: o.ORDER_TPL_NAME || '会员卡',
        payFeeYuan: o.payFeeYuan,
        payType: o.ORDER_PAY_TYPE === 'wechat' ? '微信支付' : '线下付款',
        isWechat: o.ORDER_PAY_TYPE === 'wechat',
        status: o.ORDER_STATUS,
        statusDesc: o.statusDesc,
        remark: o.ORDER_REMARK || '',
        transferProof: o.ORDER_TRANSFER_PROOF || '',
        transferReference: o.ORDER_TRANSFER_REFERENCE || '',
        hasTransferProof: !!o.ORDER_TRANSFER_PROOF,
        closeReason: o.ORDER_CLOSE_REASON || '',
        timeDesc: o.timeDesc,
        // “待确认”(线下待核对) 或 “已付待发”(微信已收款但自动发卡失败) 均可人工核对发卡
        canConfirm:
          o.ORDER_STATUS === STATUS.PENDING || o.ORDER_STATUS === STATUS.PAID,
        // 仅“待确认”的订单允许直接关闭（PAID 已实际收款，关闭需走退款，不能直接关闭）
        canClose: o.ORDER_STATUS === STATUS.PENDING,
        isPaidRecovery: o.ORDER_STATUS === STATUS.PAID,
        // 仅“微信支付 + 已发卡”的订单可原路退款
        canRefund:
          o.ORDER_STATUS === STATUS.ISSUED && o.ORDER_PAY_TYPE === 'wechat',
      }));
      this.setData({
        orders,
        loading: false,
        total: (res && res.total) || orders.length,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, orders: [] });
    }
  },

  bindConfirmTap(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '会员';
    const isPaidRecovery = e.currentTarget.dataset.paid;
    if (!id) return;
    wx.showModal({
      title: '确认收款并发卡',
      content: isPaidRecovery
        ? `「${name}」已通过微信支付成功，但系统自动发卡失败。请核对后重新发卡。`
        : `请核对「${name}」的转账凭证与到账金额。确认后将立即为其发卡。`,
      confirmText: '确认发卡',
      confirmColor: this.data.themeColor,
      success: (r) => {
        if (r.confirm) this._doConfirm(id);
      },
    });
  },

  bindPreviewProofTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url], current: url });
  },

  async _doConfirm(orderId) {
    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/card_order_confirm',
        { orderId },
        { title: '发卡中' },
      );
      wx.showToast({
        title: res && res.alreadyIssued ? '该订单已发卡' : '发卡成功',
        icon: 'success',
      });
      this._load();
    } catch (err) {
      console.error(err);
    }
  },

  bindCloseTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '关闭购卡申请',
      editable: true,
      placeholderText: '请填写关闭原因（会员可见）',
      success: (r) => {
        if (!r.confirm) return;
        const reason = (r.content || '').trim();
        if (!reason) return wx.showToast({ title: '请填写关闭原因', icon: 'none' });
        this._doClose(id, reason);
      },
    });
  },

  async _doClose(orderId, reason) {
    try {
      await cloudHelper.callCloudSumbit(
        'admin/card_order_close',
        { orderId, reason },
        { title: '处理中' },
      );
      wx.showToast({ title: '已关闭', icon: 'success' });
      this._load();
    } catch (err) {
      console.error(err);
    }
  },

  bindRefundTap(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '会员';
    if (!id) return;
    wx.showModal({
      title: '原路退款',
      editable: true,
      placeholderText: `将原路退款给「${name}」并停用该卡，请填写退款原因`,
      success: (r) => {
        if (!r.confirm) return;
        const reason = (r.content || '').trim();
        if (!reason) return wx.showToast({ title: '请填写退款原因', icon: 'none' });
        this._doRefund(id, reason);
      },
    });
  },

  async _doRefund(orderId, reason) {
    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/card_order_refund',
        { orderId, reason },
        { title: '退款中' },
      );
      wx.showToast({
        title: res && res.alreadyRefunded ? '该订单已退款' : '退款成功',
        icon: 'success',
      });
      this._load();
    } catch (err) {
      console.error(err);
    }
  },
});
