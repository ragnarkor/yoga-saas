const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');
const privateScheduleHelper = require('../../../helper/private_schedule_helper.js');

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDayStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function dayToTimestamp(day) {
  if (!day) return Date.now();
  return new Date(day.replace(/-/g, '/')).getTime();
}

function timeToMinutes(timeStr) {
  const parts = (timeStr || '00:00').split(':');
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
}

function isEndAfterStart(start, end) {
  return timeToMinutes(end) > timeToMinutes(start);
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    submitting: false,
    userId: '',
    userName: '',
    courses: [],
    bufferPresets: privateScheduleHelper.BUFFER_PRESETS,
    conflictText: '',
    blockText: '',
    slotHasConflict: false,
    slotOk: false,
    metaLoadFailed: false,
    form: {
      meetId: '',
      courseName: '',
      teacherId: '',
      teacherName: '',
      day: '',
      dayDisplay: '',
      start: '10:00',
      end: '11:00',
      duration: 60,
      cardId: '',
      cardName: '',
      bufferPreset: 'default',
      bufferBefore: '15',
      bufferAfter: '15',
      memo: '',
    },
    datePickerShow: false,
    timePickerShow: false,
    timePickerField: 'start',
    datePickerMin: new Date().getTime(),
    calendarDefaultDate: new Date().getTime(),
  },

  onShow() {
    if (this.data.userId && this.data.userName) {
      this.setData({
        navTitle: '私教代约 · ' + this.data.userName,
      });
    }
  },

  onLoad(options) {
    this._applyCoachTheme();
    const userId = options.userId || '';
    const userName = decodeURIComponent(options.userName || '');
    this.setData({
      userId,
      userName,
      navTitle: userName ? '私教代约 · ' + userName : '私教代约',
    });
    this._initPage();
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, metaLoadFailed: false });
    try {
      const [metaRes] = await Promise.all([
        cloudHelper.callCloudData('admin/private_meta', {}, { hint: false }),
      ]);
      if (!metaRes) {
        this.setData({ loading: false, metaLoadFailed: true, courses: [] });
        return;
      }
      const courses = (metaRes && metaRes.courses) || [];
      const presets = (metaRes && metaRes.bufferPresets) || [];
      const def = presets.find((p) => p.key === 'default') || { before: 15, after: 15 };
      this.setData({
        loading: false,
        courses,
        bufferPresets: presets.length ? presets : this.data.bufferPresets,
        'form.bufferBefore': String(def.before != null ? def.before : 15),
        'form.bufferAfter': String(def.after != null ? def.after : 15),
      });
      if (courses.length === 1) {
        this._applyCourse(courses[0]);
      }
      this._checkConflict();
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, metaLoadFailed: true, courses: [] });
    }
  },

  onCoursePick(e) {
    const raw = (e.detail && e.detail.meet) || (e.detail && e.detail.course);
    this._applyCourse(raw);
  },

  onUserCardPick(e) {
    const { cardId, cardName } = e.detail || {};
    this.setData({
      'form.cardId': cardId || '',
      'form.cardName': cardName || '',
    });
  },

  onCoachPick(e) {
    const { teacherId, teacherName } = e.detail || {};
    this.setData({
      'form.teacherId': teacherId || '',
      'form.teacherName': teacherName || '',
    }, () => this._checkConflict());
  },

  bindMemoChange(e) {
    this.setData({ 'form.memo': e.detail });
  },

  _applyCourse(course) {
    if (!course) return;
    this.setData({
      'form.meetId': course._id,
      'form.courseName': course.title,
      'form.duration': course.duration || 60,
    });
    if (!this.data.form.teacherId && course.teacherId) {
      this.setData({
        'form.teacherId': course.teacherId,
        'form.teacherName': course.teacherName || '',
      });
    }
    this._suggestEndFromDuration();
    this._checkConflict();
  },

  _suggestEndFromDuration() {
    const { form } = this.data;
    const duration = Number(form.duration) || 60;
    const end = scheduleSlotHelper.addMinutesToTime(form.start || '10:00', duration);
    this.setData({ 'form.end': end });
  },

  async _checkConflict() {
    const { form } = this.data;
    if (!form.teacherId || !form.day || !form.start || !form.end) {
      this.setData({ conflictText: '', blockText: '', slotHasConflict: false, slotOk: false });
      return;
    }
    try {
      const params = {
        teacherId: form.teacherId,
        day: form.day,
        start: form.start,
        end: form.end,
        bufferPreset: form.bufferPreset,
      };
      if (form.bufferPreset === 'custom') {
        params.bufferBefore = Number(form.bufferBefore) || 0;
        params.bufferAfter = Number(form.bufferAfter) || 0;
      }
      const res = await cloudHelper.callCloudData(
        'admin/private_check',
        params,
        { hint: false },
      );
      if (!res) return;
      const blockText = '占用时段 ' + (res.blockStart || '') + '–' + (res.blockEnd || '');
      if (res.ok) {
        this.setData({ conflictText: '时段可用', blockText, slotHasConflict: false, slotOk: true });
      } else {
        const hit = (res.conflicts && res.conflicts[0]) || null;
        const msg = hit
          ? '与「' + hit.title + ' ' + hit.time + '」冲突'
          : '时段冲突';
        this.setData({ conflictText: msg, blockText, slotHasConflict: true, slotOk: false });
      }
    } catch (e) {
      console.error(e);
    }
  },

  bindPickMemberTap() {
    wx.navigateTo({
      url: '/pages/coach/member/coach_member_list?pick=1',
    });
  },

  bindDayTap() {
    const { form } = this.data;
    this.setData({
      datePickerShow: true,
      calendarDefaultDate: form.day ? dayToTimestamp(form.day) : Date.now(),
    });
  },

  bindDateClose() {
    this.setData({ datePickerShow: false });
  },

  _applySelectedDay(raw) {
    if (raw == null) return false;
    let picked = raw;
    if (Array.isArray(picked)) picked = picked[0];
    const d = picked instanceof Date ? picked : new Date(picked);
    if (Number.isNaN(d.getTime())) return false;
    const day = formatDayStr(d);
    this.setData({
      datePickerShow: false,
      calendarDefaultDate: d.getTime(),
      'form.day': day,
      'form.dayDisplay': privateScheduleHelper.buildDayDesc(day),
    }, () => this._checkConflict());
    return true;
  },

  bindCalendarConfirm(e) {
    if (!this._applySelectedDay(e.detail)) {
      wx.showToast({ title: '请选择有效日期', icon: 'none' });
    }
  },

  bindStartTap() {
    this.setData({ timePickerShow: true, timePickerField: 'start' });
  },

  bindEndTap() {
    this.setData({ timePickerShow: true, timePickerField: 'end' });
  },

  bindTimeClose() {
    this.setData({ timePickerShow: false });
  },

  bindTimeConfirm(e) {
    const time = e.detail;
    const field = this.data.timePickerField;
    if (field === 'end') {
      const start = this.data.form.start;
      if (!isEndAfterStart(start, time)) {
        wx.showToast({ title: '结束时间须晚于开始时间', icon: 'none' });
        this.setData({ timePickerShow: false });
        return;
      }
      this.setData({ timePickerShow: false, 'form.end': time }, () => this._checkConflict());
      return;
    }
    this.setData({ timePickerShow: false, 'form.start': time }, () => {
      const { start, end } = this.data.form;
      if (!isEndAfterStart(start, end)) {
        wx.showToast({ title: '请调整结束时间', icon: 'none' });
      }
      this._checkConflict();
    });
  },

  bindBufferPresetTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const preset = (this.data.bufferPresets || []).find((p) => p.key === key);
    const patch = { 'form.bufferPreset': key };
    if (key !== 'custom' && preset) {
      patch['form.bufferBefore'] = String(preset.before != null ? preset.before : 15);
      patch['form.bufferAfter'] = String(preset.after != null ? preset.after : 15);
    }
    this.setData(patch, () => this._checkConflict());
  },

  bindBufferBeforeChange(e) {
    this.setData({ 'form.bufferBefore': e.detail, 'form.bufferPreset': 'custom' }, () => this._checkConflict());
  },

  bindBufferAfterChange(e) {
    this.setData({ 'form.bufferAfter': e.detail, 'form.bufferPreset': 'custom' }, () => this._checkConflict());
  },

  async bindSubmitTap() {
    if (this.data.submitting) return;
    const { userId, form, slotHasConflict } = this.data;
    if (!userId) {
      wx.showToast({ title: '请选择会员', icon: 'none' });
      return;
    }
    if (!form.meetId || !form.day || !form.start || !form.end || !form.teacherId) {
      wx.showToast({ title: '请完善预约信息', icon: 'none' });
      return;
    }
    if (!isEndAfterStart(form.start, form.end)) {
      wx.showToast({ title: '结束时间须晚于开始时间', icon: 'none' });
      return;
    }
    if (slotHasConflict) {
      const confirm = await new Promise((resolve) => {
        wx.showModal({
          title: '时段冲突',
          content: this.data.conflictText + '，仍要强制预约？',
          success: (res) => resolve(res.confirm),
        });
      });
      if (!confirm) return;
    }

    this.setData({ submitting: true });
    try {
      const params = {
        meetId: form.meetId,
        userId,
        day: form.day,
        start: form.start,
        end: form.end,
        teacherId: form.teacherId,
        teacherName: form.teacherName,
        cardId: form.cardId || '',
        bufferPreset: form.bufferPreset,
        memo: form.memo || '',
        force: slotHasConflict,
      };
      if (form.bufferPreset === 'custom') {
        params.bufferBefore = Number(form.bufferBefore) || 0;
        params.bufferAfter = Number(form.bufferAfter) || 0;
      }
      await cloudHelper.callCloudSumbit('admin/private_book', params, { title: '预约中' });
      wx.showToast({ title: '预约成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
