const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');
const timeHelper = require('../../../helper/time_helper.js');

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDayStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseDayDisplay(day) {
  if (!day) return '';
  return timeHelper.fmtDateCHN(day) + ' (' + timeHelper.week(day) + ')';
}

function formatDaysDisplay(days) {
  const list = (days || []).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return parseDayDisplay(list[0]);
  return '已选 ' + list.length + ' 天';
}

function dayToTimestamp(day) {
  if (!day) return new Date().getTime();
  return new Date(day.replace(/-/g, '/')).getTime();
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    saving: false,
    pageTitle: '新增排课',
    isEdit: false,
    mark: '',
    formMeetId: '',
    duration: 60,
    formDays: [],
    formDayDisplay: '',
    formStartTime: '09:00',
    formEndTime: '10:00',
    formTeacherId: '',
    formTeacherName: '',
    formLimit: '',
    datePickerShow: false,
    timePickerShow: false,
    datePickerMin: new Date().getTime(),
    calendarDefaultDate: [],
  },

  onLoad(options) {
    this._applyCoachTheme();
    const formDays = options.day ? [options.day] : [];
    const teacherName = options.teacherName
      ? decodeURIComponent(options.teacherName)
      : '';
    this.setData({
      pageTitle: options.mark ? '编辑排课' : '新增排课',
      isEdit: !!options.mark,
      mark: options.mark || '',
      formMeetId: options.meetId || '',
      formDays,
      formDayDisplay: formatDaysDisplay(formDays),
      formStartTime: options.start || options.time || '09:00',
      formEndTime: options.end || '',
      formTeacherId: options.teacherId || '',
      formTeacherName: teacherName,
      calendarDefaultDate: formDays.length
        ? formDays.map(dayToTimestamp)
        : [new Date().getTime()],
    });
    this._recalcEndTime();
    this._initPage();
  },

  async _initPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }

    if (this.data.isEdit && this.data.formMeetId && this.data.mark) {
      await this._loadEditSlot();
    } else if (this.data.formMeetId) {
      await this._loadCourseMeta(this.data.formMeetId);
    }

    this.setData({ loading: false });
  },

  async _loadCourseMeta(meetId) {
    try {
      const meet = await cloudHelper.callCloudData(
        'admin/meet_detail',
        { id: meetId },
        { hint: false },
      );
      if (meet) this._applyCourseMeta(meet);
    } catch (e) {
      console.error(e);
    }
  },

  _meetDetailParams() {
    const fromDay = this.data.formDays[0] || '';
    return fromDay ? { id: this.data.formMeetId, fromDay } : { id: this.data.formMeetId };
  },

  async _loadEditSlot() {
    try {
      const meet = await cloudHelper.callCloudData(
        'admin/meet_detail',
        this._meetDetailParams(),
        { hint: false },
      );
      if (!meet) return;

      const day = this.data.formDays[0];
      const slot = scheduleSlotHelper.findTimeSlot(meet.MEET_DAYS_SET || [], {
        day,
        mark: this.data.mark,
      });

      const meta = scheduleSlotHelper.parseCourseMeta(meet);
      const style = meet.MEET_STYLE_SET || {};
      const patch = {
        duration: meta.duration,
        formDayDisplay: formatDaysDisplay(this.data.formDays),
      };

      if (slot) {
        patch.formStartTime = slot.start || this.data.formStartTime;
        patch.formEndTime = slot.end || this.data.formEndTime;
        patch.formTeacherId = slot.teacherId || style.teacherId || '';
        patch.formTeacherName = slot.teacherName || style.teacherName || '';
        patch.formLimit =
          slot.isLimit && slot.limit > 0
            ? String(slot.limit)
            : meta.capacity > 0
              ? String(meta.capacity)
              : '';
      }

      this.setData(patch, () => this._recalcEndTime());
    } catch (e) {
      console.error(e);
    }
  },

  _applyCourseMeta(meet) {
    if (!meet || !meet._id) return;
    const meetId = meet._id;
    const meta = scheduleSlotHelper.parseCourseMeta(meet);
    const style = meet.MEET_STYLE_SET || {};
    const patch = {
      formMeetId: meetId,
      duration: meta.duration,
    };
    if (!this.data.isEdit) {
      patch.formLimit = meta.capacity > 0 ? String(meta.capacity) : '';
      if (!this.data.formTeacherId) {
        patch.formTeacherId = style.teacherId || '';
        patch.formTeacherName = style.teacherName || '';
      }
    }
    this.setData(patch, () => this._recalcEndTime());
  },

  onCoursePick(e) {
    const { meet } = e.detail || {};
    if (meet && meet.MEET_TITLE) {
      this._applyCourseMeta(meet);
      return;
    }
    const meetId = e.detail && e.detail.meetId;
    if (meetId) this._loadCourseMeta(meetId);
  },

  _recalcEndTime() {
    const formEndTime = scheduleSlotHelper.addMinutesToTime(
      this.data.formStartTime,
      this.data.duration,
    );
    this.setData({ formEndTime });
  },

  onCoachPick(e) {
    const { teacherId, teacherName } = e.detail || {};
    this.setData({
      formTeacherId: teacherId || '',
      formTeacherName: teacherName || '',
    });
  },

  bindDayTap() {
    if (this.data.isEdit) {
      wx.showToast({ title: '编辑时不可修改日期', icon: 'none' });
      return;
    }
    const defaultDates = this.data.formDays.length
      ? this.data.formDays.map(dayToTimestamp)
      : [new Date().getTime()];
    this.setData({
      datePickerShow: true,
      calendarDefaultDate: defaultDates,
    });
  },

  bindDatePickerClose() {
    this.setData({ datePickerShow: false });
  },

  bindCalendarConfirm(e) {
    const dates = e.detail || [];
    const formDays = dates
      .map((item) => formatDayStr(item instanceof Date ? item : new Date(item)))
      .sort();
    this.setData({
      datePickerShow: false,
      formDays,
      formDayDisplay: formatDaysDisplay(formDays),
      calendarDefaultDate: dates.map((item) =>
        item instanceof Date ? item.getTime() : new Date(item).getTime(),
      ),
    });
  },

  bindStartTimeTap() {
    this.setData({ timePickerShow: true });
  },

  bindTimePickerClose() {
    this.setData({ timePickerShow: false });
  },

  bindTimeConfirm(e) {
    this.setData(
      {
        timePickerShow: false,
        formStartTime: e.detail,
      },
      () => this._recalcEndTime(),
    );
  },

  bindLimitChange(e) {
    this.setData({ formLimit: e.detail });
  },

  async bindSaveTap() {
    if (this.data.saving) return;

    const {
      formMeetId,
      formDays,
      formStartTime,
      formEndTime,
      formTeacherId,
      formTeacherName,
      formLimit,
      mark,
      isEdit,
    } = this.data;

    if (!formMeetId) {
      wx.showToast({ title: '请选择课程', icon: 'none' });
      return;
    }
    if (!formDays.length) {
      wx.showToast({ title: '请选择上课日期', icon: 'none' });
      return;
    }
    if (!formStartTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'none' });
      return;
    }
    if (!formTeacherId) {
      wx.showToast({ title: '请选择授课老师', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const meet = await cloudHelper.callCloudData(
        'admin/meet_detail',
        { id: formMeetId, fromDay: formDays[0] },
        { title: 'bar' },
      );
      if (!meet) {
        wx.showToast({ title: '课程不存在', icon: 'none' });
        return;
      }

      const limit = Number(formLimit) || 0;
      let daysSet = meet.MEET_DAYS_SET || [];
      const targetDays = isEdit ? [formDays[0]] : formDays;

      for (const day of targetDays) {
        daysSet = scheduleSlotHelper.upsertTimeSlot(daysSet, {
          day,
          start: formStartTime,
          end: formEndTime,
          limit,
          mark: isEdit ? mark : '',
          teacherId: formTeacherId,
          teacherName: formTeacherName,
        });
      }

      await cloudHelper.callCloudSumbit(
        'admin/meet_edit',
        {
          id: meet._id,
          title: meet.MEET_TITLE,
          typeId: meet.MEET_TYPE_ID,
          typeName: meet.MEET_TYPE_NAME,
          order: meet.MEET_ORDER,
          daysSet,
          isShowLimit: meet.MEET_IS_SHOW_LIMIT,
          formSet: meet.MEET_FORM_SET || [],
        },
        { title: '保存中' },
      );

      wx.showToast({
        title: isEdit ? '已更新' : targetDays.length > 1 ? '已排 ' + targetDays.length + ' 天' : '排课成功',
        icon: 'success',
      });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ saving: false });
    }
  },

  bindDeleteTap() {
    if (!this.data.isEdit || !this.data.mark) return;
    wx.showModal({
      title: '删除排课',
      content: '确定删除该时段吗？已有预约的时段无法删除。',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) this._deleteSlot();
      },
    });
  },

  async _deleteSlot() {
    const { formMeetId, formDays, mark } = this.data;
    if (!formMeetId || !mark || !formDays.length) return;

    this.setData({ saving: true });
    try {
      await cloudHelper.callCloudSumbit(
        'admin/schedule_slot_remove',
        {
          meetId: formMeetId,
          day: formDays[0],
          mark: String(mark),
        },
        { title: '删除中' },
      );

      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ saving: false });
    }
  },
});
