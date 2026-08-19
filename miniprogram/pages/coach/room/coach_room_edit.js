const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],
  data: {
    loading: true, saving: false, pageTitle: '新增教室', roomId: '', rooms: [],
    form: { name: '', location: '', capacity: '', equipment: '', enabled: true },
  },

  onLoad(options) { this._applyCoachTheme(); this.setData({ roomId: options.id || '', pageTitle: options.id ? '编辑教室' : '新增教室' }); this._load(); },
  async _load() {
    try {
      const ok = await AdminWxBiz.ensureSession(); if (!ok) return;
      const data = await cloudHelper.callCloudData('admin/tenant_room_list', {}, { title: 'bar' });
      const rooms = (data && data.rooms) || [];
      const room = rooms.find((item) => item.id === this.data.roomId);
      if (this.data.roomId && !room) { wx.showToast({ title: '教室不存在或已删除', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return; }
      this.setData({ loading: false, rooms, form: room ? { ...room, capacity: room.capacity || '' } : this.data.form });
    } catch (err) { console.error(err); this.setData({ loading: false }); }
  },
  bindFieldChange(e) { const field = e.currentTarget.dataset.field; this.setData({ [`form.${field}`]: e.detail }); },
  bindEnabledChange(e) { this.setData({ 'form.enabled': !!e.detail.value }); },
  async bindSaveTap() {
    if (this.data.saving) return;
    const form = this.data.form;
    const name = String(form.name || '').trim();
    if (!name) { wx.showToast({ title: '请填写教室名称', icon: 'none' }); return; }
    const room = { id: form.id || this.data.roomId || '', name, location: String(form.location || '').trim(), capacity: Number(form.capacity) || 0, equipment: String(form.equipment || '').trim(), enabled: form.enabled !== false };
    const rooms = this.data.roomId ? this.data.rooms.map((item) => item.id === this.data.roomId ? room : item) : this.data.rooms.concat(room);
    this.setData({ saving: true });
    try {
      await cloudHelper.callCloudSumbit('admin/tenant_room_save', { rooms }, { title: '保存中' });
      const pages = getCurrentPages();
      const previous = pages[pages.length - 2];
      if (previous && typeof previous._loadRooms === 'function') await previous._loadRooms();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) { console.error(err); } finally { this.setData({ saving: false }); }
  },
});
