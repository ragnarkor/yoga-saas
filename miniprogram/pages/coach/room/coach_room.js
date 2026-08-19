const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],
  data: { loading: true, canEdit: false, rooms: [] },
  onLoad() { this._applyCoachTheme(); },
  onShow() { this._loadRooms(); },
  onPullDownRefresh() { this._loadRooms().finally(() => wx.stopPullDownRefresh()); },
  async _loadRooms() {
    try {
      const ok = await AdminWxBiz.ensureSession();
      if (!ok) return;
      const data = await cloudHelper.callCloudData('admin/tenant_room_list', {}, { title: 'bar' });
      const admin = AdminBiz.getAdminToken();
      this.setData({
        loading: false,
        canEdit: !!admin && (admin.type === 'owner' || admin.type === 'super'),
        rooms: ((data && data.rooms) || []).map((item) => ({ ...item })),
      });
    } catch (err) { console.error(err); this.setData({ loading: false }); }
  },
  bindAddTap() { wx.navigateTo({ url: '/pages/coach/room/coach_room_edit' }); },
  bindRoomTap(e) { wx.navigateTo({ url: `/pages/coach/room/coach_room_edit?id=${e.currentTarget.dataset.id}` }); },
  bindSwipeOpen(e) {
    const id = e.currentTarget.dataset.swipeId;
    if (this._openSwipeId && this._openSwipeId !== id) {
      const old = this.selectComponent(`#room-swipe-${this._openSwipeId}`);
      if (old) old.close();
    }
    this._openSwipeId = id;
  },
  async bindDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    const room = this.data.rooms.find((item) => item.id === id);
    if (!room) return;
    const swipe = this.selectComponent(`#room-swipe-${e.currentTarget.dataset.swipeId}`);
    if (swipe) swipe.close();
    const modal = await new Promise((resolve) => wx.showModal({ title: '删除教室', content: `确认删除「${room.name}」？已排课程不会受影响。`, success: resolve }));
    if (!modal.confirm) return;
    try {
      const rooms = this.data.rooms.filter((item) => item.id !== id);
      await cloudHelper.callCloudSumbit('admin/tenant_room_save', { rooms }, { title: '删除中' });
      wx.showToast({ title: '已删除', icon: 'success' });
      await this._loadRooms();
    } catch (err) { console.error(err); }
  },
});
