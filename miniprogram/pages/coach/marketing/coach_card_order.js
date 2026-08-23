const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const STATUS = { PENDING: 1, CONFIRMING: 5, ISSUED: 10, CLOSED: 20 };
const TABS = [
  { key: 'pending', label: '待确认', status: STATUS.PENDING },
  { key: 'issued', label: '已发卡', status: STATUS.ISSUED },
  { key: 'closed', label: '已关闭', status: STATUS.CLOSED },
  { key: 'all', label: '全部', status: '' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    tabs: TABS,
    activeTab: 'pending',
    orders: [],
    loading: true,
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
    if (!key || key === this.data.activeTab) return;
    this.setData({ activeTab: key }, () => this._load());
  },

  _currentStatus() {
    const tab = TABS.find((item) => item.key === this.data.activeTab);
    return tab ? tab.status : STATUS.PENDING;
  },

  async _load() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return this.setData({ loading: false });
    this.setData({ loading: true });
    try {
      const params = { page: 1, size: 100 };
      const status = this._currentStatus();
      if (status !== '') params.status = status;
      const res = await cloudHelper.callCloudData('admin/card_order_list', params, { hint: false });
      const orders = ((res && res.list) || []).map((item) => ({
        id: item.ORDER_ID,
        userName: item.ORDER_USER_NAME || '会员',
        cardName: item.ORDER_TPL_NAME || '会员卡',
        price: item.payFeeYuan || '0.00',
        status: item.ORDER_STATUS,
        statusDesc: item.statusDesc || '',
        time: item.timeDesc || '',
        remark: item.ORDER_REMARK || '',
        closeReason: item.ORDER_CLOSE_REASON || '',
        canAct: item.ORDER_STATUS === STATUS.PENDING,
      }));
      this.setData({ orders, loading: false });
    } catch (err) {
      console.error(err);
      this.setData({ orders: [], loading: false });
    }
  },

  bindConfirmTap(e) {
    const { id, name, card } = e.currentTarget.dataset;
    if (!id) return;
    wx.showModal({
      title: '确认收款并发卡',
      content: `确认已收到「${name || '会员'}」购买「${card || '会员卡'}」的款项？确认后会立即发卡。`,
      confirmText: '确认发卡',
      confirmColor: this.data.themeColor,
      success: (res) => res.confirm && this._confirm(id),
    });
  },

  async _confirm(orderId) {
    try {
      const res = await cloudHelper.callCloudSumbit('admin/card_order_confirm', { orderId }, { title: '发卡中' });
      wx.showToast({ title: res && res.alreadyIssued ? '该申请已发卡' : '发卡成功', icon: 'success' });
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
      success: (res) => {
        const reason = String(res.content || '').trim();
        if (!res.confirm) return;
        if (!reason) return wx.showToast({ title: '请填写关闭原因', icon: 'none' });
        this._close(id, reason);
      },
    });
  },

  async _close(orderId, reason) {
    try {
      await cloudHelper.callCloudSumbit('admin/card_order_close', { orderId, reason }, { title: '处理中' });
      wx.showToast({ title: '已关闭', icon: 'success' });
      this._load();
    } catch (err) {
      console.error(err);
    }
  },
});
