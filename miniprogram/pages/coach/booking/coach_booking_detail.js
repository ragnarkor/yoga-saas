const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');
const joinRosterHelper = require('./booking_detail_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    meetId: '',
    mark: '',
    session: {},
    sessionStatus: '',
    capacityText: '',
    seatPercent: 0,
    starText: '',
    filters: joinRosterHelper.FILTERS,
    activeFilter: 'all',
    keyword: '',
    sections: [],
    displayList: [],
    counts: { pending: 0, checked: 0, cancelled: 0, total: 0 },
    cancelAllShow: false,
    cancelOneShow: false,
    cancelReason: '',
    cancelTargetId: '',
    cancelTargetIdx: -1,
    batchCheckinLoading: false,
    bookSheetShow: false,
    bookSubmitting: false,
    bookUserId: '',
    bookUserName: '',
    bookCardId: '',
    bookMemo: '',
  },

  onLoad(options) {
    this._applyCoachTheme();
    const session = {
      day: options.day || '',
      title: decodeURIComponent(options.title || ''),
      start: decodeURIComponent(options.start || ''),
      end: decodeURIComponent(options.end || ''),
      teacherName: decodeURIComponent(options.teacherName || ''),
      typeName: decodeURIComponent(options.typeName || ''),
      duration: Number(options.duration) || 60,
      limit: Number(options.limit) || 0,
      booked: Number(options.booked) || 0,
      difficulty: Number(options.difficulty) || 3,
      slotStatus: Number(options.slotStatus != null ? options.slotStatus : 1),
    };
    this.setData({
      meetId: options.meetId || '',
      mark: decodeURIComponent(options.mark || ''),
      session,
      starText: joinRosterHelper.buildStarText(session.difficulty),
      capacityText: joinRosterHelper.buildCapacityText(session.booked, session.limit),
      seatPercent: joinRosterHelper.buildSeatPercent(session.booked, session.limit),
      sessionStatus: joinRosterHelper.resolveSessionStatus(session),
    });
    this._loadRoster();
  },

  onShow() {
    if (!this.data.loading && this.data.meetId) {
      this._loadRoster();
    }
  },

  onPullDownRefresh() {
    this._loadRoster().finally(() => wx.stopPullDownRefresh());
  },

  _applyRoster() {
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    let list = this._fullRawList || [];
    if (keyword) {
      list = list.filter((raw) => {
        const m = joinRosterHelper.parseJoinMember(raw);
        const hay = `${m.name}${m.mobile}${raw.JOIN_CODE || ''}`.toLowerCase();
        return hay.includes(keyword);
      });
    }
    const groups = joinRosterHelper.groupMembers(list);
    const counts = {
      pending: groups.pending.length,
      checked: groups.checked.length,
      cancelled: groups.cancelled.length,
      total: groups.pending.length + groups.checked.length + groups.cancelled.length,
    };
    const activeBooked = groups.pending.length + groups.checked.length;
    const session = {
      ...this.data.session,
      booked: activeBooked,
    };
    this.setData({
      sections: joinRosterHelper.buildSections(groups, this.data.activeFilter),
      displayList: joinRosterHelper.buildFlatList(groups, this.data.activeFilter),
      counts,
      capacityText: joinRosterHelper.buildCapacityText(
        activeBooked,
        this.data.session.limit,
      ),
      seatPercent: joinRosterHelper.buildSeatPercent(
        activeBooked,
        this.data.session.limit,
      ),
      session,
      sessionStatus: joinRosterHelper.resolveSessionStatus(session),
    });
  },

  async _loadRoster() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    const { meetId, mark } = this.data;
    if (!meetId || !mark) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      let page = 1;
      let all = [];
      let total = 0;
      const size = 50;
      do {
        const res = await cloudHelper.callCloudData(
          'admin/meet_join_list',
          { meetId, mark, page, size, isTotal: page === 1 },
          { hint: false, title: page === 1 ? 'bar' : 'bar' },
        );
        const batch = (res && res.list) || [];
        if (page === 1) total = (res && res.total) || batch.length;
        for (let i = 0; i < batch.length; i++) {
          const raw = batch[i];
          if (raw.memberPic) {
            try {
              raw.avatarSrc = await UserProfileBiz.resolveAvatarUrl(raw.memberPic);
            } catch (e) {
              raw.avatarSrc = '';
            }
          }
          all.push(raw);
        }
        if (batch.length < size) break;
        page += 1;
      } while (all.length < total && page <= 20);

      this._fullRawList = all;
      this._applyRoster();
      this.setData({ loading: false });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, sections: [], displayList: [] });
    }
  },

  bindSearchInput(e) {
    this.setData({ keyword: e.detail.value || '' });
  },

  bindSearchConfirm() {
    this._applyRoster();
  },

  bindFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => {
      this._applyRoster();
    });
  },

  bindPhoneTap(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: String(phone) });
  },

  bindCheckinTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const id = e.currentTarget.dataset.id;
    const flag = Number(e.currentTarget.dataset.flag);
    const title = flag === 1 ? '确认签到核销？' : '确认取消签到？';
    wx.showModal({
      title,
      success: async (res) => {
        if (!res.confirm) return;
        await this._doCheckin(id, idx, flag);
      },
    });
  },

  async _doCheckin(joinId, idx, flag) {
    try {
      await cloudHelper.callCloudSumbit(
        'admin/join_checkin',
        { joinId, flag },
        { title: '处理中' },
      );
      wx.showToast({ title: '已更新', icon: 'success' });
      this._loadRoster();
    } catch (e) {
      console.error(e);
    }
  },

  bindCheckinAllTap() {
    const pending = this.data.counts.pending || 0;
    if (!pending) {
      wx.showToast({ title: '暂无待签到会员', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '一键签到',
      content: '确认为 ' + pending + ' 人签到核销？',
      success: async (res) => {
        if (!res.confirm) return;
        await this._doBatchCheckin();
      },
    });
  },

  async _doBatchCheckin() {
    const { meetId, mark } = this.data;
    if (!meetId || !mark) return;

    this.setData({ batchCheckinLoading: true });
    try {
      const res = await cloudHelper.callCloudSumbit(
        'admin/join_checkin_batch',
        { meetId, timeMark: mark, flag: 1 },
        { title: '签到中' },
      );
      const count = (res && res.data && res.data.count != null)
        ? res.data.count
        : this.data.counts.pending;
      wx.showToast({
        title: count > 0 ? '已签到 ' + count + ' 人' : '暂无待签到',
        icon: count > 0 ? 'success' : 'none',
      });
      this._loadRoster();
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ batchCheckinLoading: false });
    }
  },

  bindCancelOneTap(e) {
    this.setData({
      cancelOneShow: true,
      cancelTargetId: e.currentTarget.dataset.id || '',
      cancelTargetIdx: Number(e.currentTarget.dataset.idx),
      cancelReason: '',
    });
  },

  bindCloseCancelOne() {
    this.setData({ cancelOneShow: false, cancelTargetId: '', cancelTargetIdx: -1 });
  },

  bindCancelReasonInput(e) {
    this.setData({ cancelReason: e.detail.value || '' });
  },

  async bindConfirmCancelOne() {
    const { cancelTargetId } = this.data;
    if (!cancelTargetId) return;
    try {
      await cloudHelper.callCloudSumbit(
        'admin/join_status',
        {
          joinId: cancelTargetId,
          status: 10,
          reason: (this.data.cancelReason || '').trim(),
        },
        { title: '处理中' },
      );
      wx.showToast({ title: '已取消', icon: 'success' });
      this.setData({ cancelOneShow: false, activeFilter: 'cancelled' });
      this._loadRoster();
    } catch (e) {
      console.error(e);
    }
  },

  bindRestoreTap(e) {
    const joinId = e.currentTarget.dataset.id;
    if (!joinId) return;
    wx.showModal({
      title: '确认恢复预约？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await cloudHelper.callCloudSumbit(
            'admin/join_status',
            { joinId, status: 1, reason: '' },
            { title: '处理中' },
          );
          wx.showToast({ title: '已恢复', icon: 'success' });
          this._loadRoster();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },

  bindCancelAllTap() {
    this.setData({ cancelAllShow: true, cancelReason: '' });
  },

  bindCloseCancelAll() {
    this.setData({ cancelAllShow: false });
  },

  async bindConfirmCancelAll() {
    const { meetId, mark } = this.data;
    try {
      await cloudHelper.callCloudSumbit(
        'admin/meet_cancel_time_join',
        {
          meetId,
          timeMark: mark,
          reason: (this.data.cancelReason || '').trim(),
        },
        { title: '取消中' },
      );
      wx.showToast({ title: '已取消本节', icon: 'success' });
      const session = { ...this.data.session, slotStatus: 0, booked: 0 };
      this.setData({
        cancelAllShow: false,
        activeFilter: 'cancelled',
        session,
        sessionStatus: joinRosterHelper.resolveSessionStatus(session),
      });
      this._loadRoster();
    } catch (e) {
      console.error(e);
    }
  },

  bindRestoreSlotTap() {
    wx.showModal({
      title: '恢复本节？',
      content: '恢复后可继续代约，本节状态将变为可预约',
      success: async (res) => {
        if (!res.confirm) return;
        const { meetId, mark } = this.data;
        try {
          await cloudHelper.callCloudSumbit(
            'admin/meet_restore_time_slot',
            { meetId, timeMark: mark },
            { title: '恢复中' },
          );
          wx.showToast({ title: '已恢复本节', icon: 'success' });
          const session = { ...this.data.session, slotStatus: 1 };
          this.setData({
            session,
            sessionStatus: joinRosterHelper.resolveSessionStatus(session),
          });
          this._loadRoster();
        } catch (err) {
          console.error(err);
        }
      },
    });
  },

  bindQrTap() {
    const { mark, session } = this.data;
    const title = encodeURIComponent(session.title || '');
    wx.navigateTo({
      url: `/pages/admin/meet/self/admin_meet_self?mark=${encodeURIComponent(mark)}&title=${title}`,
    });
  },

  _isSessionFull() {
    const { session, counts } = this.data;
    const limit = Number(session.limit) || 0;
    if (limit <= 0) return false;
    const booked = (counts.pending || 0) + (counts.checked || 0);
    return booked >= limit;
  },

  bindBookTap() {
    const { session } = this.data;
    if (session.slotStatus === 0) {
      wx.showToast({ title: '本节已取消，无法代约', icon: 'none' });
      return;
    }
    if (this._isSessionFull()) {
      wx.showToast({ title: '本节已满员', icon: 'none' });
      return;
    }
    this.setData({ bookSheetShow: true });
  },

  bindCloseBookSheet() {
    this.setData({ bookSheetShow: false });
  },

  bindPickMemberTap() {
    wx.navigateTo({
      url: '/pages/coach/member/coach_member_list?pick=1',
    });
  },

  onBookCardPick(e) {
    const { cardId } = e.detail || {};
    this.setData({ bookCardId: cardId || '' });
  },

  bindBookMemoInput(e) {
    this.setData({ bookMemo: e.detail.value || '' });
  },

  async bindConfirmBookTap() {
    if (this.data.bookSubmitting) return;
    const { meetId, mark, bookUserId, bookCardId, bookMemo } = this.data;
    if (!bookUserId) {
      wx.showToast({ title: '请选择会员', icon: 'none' });
      return;
    }
    if (this._isSessionFull()) {
      wx.showToast({ title: '本节已满员', icon: 'none' });
      return;
    }

    this.setData({ bookSubmitting: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/group_book',
        {
          meetId,
          timeMark: mark,
          userId: bookUserId,
          cardId: bookCardId || '',
          memo: (bookMemo || '').trim(),
        },
        { title: '预约中' },
      );
      wx.showToast({ title: '代约成功', icon: 'success' });
      this.setData({
        bookSheetShow: false,
        bookUserId: '',
        bookUserName: '',
        bookCardId: '',
        bookMemo: '',
      });
      this._loadRoster();
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ bookSubmitting: false });
    }
  },
});
