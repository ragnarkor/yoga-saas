const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');
const timeHelper = require('../../../helper/time_helper.js');

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 统一处理从日历、dataset 或 query 传入的时间，避免对象值被直接渲染成乱码。
function normalizeTime(value, fallback = '') {
  const raw = typeof value === 'string'
    ? value
    : value && (value.time || value.start || value.value);
  const match = String(raw || '').match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (!match) return fallback;
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return pad2(hour) + ':' + pad2(minute);
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

function addDays(day, offset) {
  const date = new Date(String(day).replace(/-/g, '/') + ' 12:00:00');
  date.setDate(date.getDate() + Number(offset || 0));
  return formatDayStr(date);
}

function buildWeekOptions(selected = []) {
  const selectedSet = new Set((selected || []).map(Number));
  return [
    { value: 1, label: '周一', selected: selectedSet.has(1) },
    { value: 2, label: '周二', selected: selectedSet.has(2) },
    { value: 3, label: '周三', selected: selectedSet.has(3) },
    { value: 4, label: '周四', selected: selectedSet.has(4) },
    { value: 5, label: '周五', selected: selectedSet.has(5) },
    { value: 6, label: '周六', selected: selectedSet.has(6) },
    { value: 0, label: '周日', selected: selectedSet.has(0) },
  ];
}

function buildRepeatDays(startDay, endDay, weekdays = []) {
  if (!startDay || !endDay || startDay > endDay || !weekdays.length) return [];
  const weekdaySet = new Set(weekdays.map(Number));
  const days = [];
  let day = startDay;
  // 限制单次最多生成一年，避免误选超长区间导致页面卡顿。
  for (let i = 0; i < 366 && day <= endDay; i++) {
    const date = new Date(day.replace(/-/g, '/') + ' 12:00:00');
    if (weekdaySet.has(date.getDay())) days.push(day);
    day = addDays(day, 1);
  }
  return days;
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
    formTimeSlots: [],
    formTeacherId: '',
    formTeacherName: '',
    roomOptions: [],
    roomPickerShow: false,
    formRoomId: '',
    formRoomName: '',
    formRoomPickerIndex: 0,
    formLimit: '',
    datePickerShow: false,
    timePickerShow: false,
    datePickerMin: new Date().getTime(),
    calendarDefaultDate: [],
    minDay: '',
    batchStartDay: '',
    batchEndDay: '',
    batchWeekdays: [],
    weekOptions: [],
    scheduleMode: 'repeat',
  },

  onLoad(options) {
    this._applyCoachTheme();
    const formDays = options.day ? [options.day] : [];
    const minDay = formatDayStr(new Date());
    const initialStart = normalizeTime(options.start || options.time, '09:00');
    const initialEnd = normalizeTime(options.end, '');
    const teacherName = options.teacherName
      ? decodeURIComponent(options.teacherName)
      : '';
    const roomName = options.room
      ? decodeURIComponent(options.room)
      : '';
    this.setData({
      pageTitle: options.mark ? '编辑排课' : '新增排课',
      isEdit: !!options.mark,
      mark: options.mark || '',
      formMeetId: options.meetId || '',
      formDays,
      formDayDisplay: formatDaysDisplay(formDays),
      formStartTime: initialStart,
      formEndTime: initialEnd,
      formTimeSlots: [{ start: initialStart, end: initialEnd }],
      formTeacherId: options.teacherId || '',
      formTeacherName: teacherName,
      formRoomName: roomName,
      calendarDefaultDate: formDays.length
        ? formDays.map(dayToTimestamp)
        : [new Date().getTime()],
      minDay,
      batchStartDay: minDay,
      batchEndDay: addDays(minDay, 27),
      batchWeekdays: [],
      weekOptions: buildWeekOptions(),
      scheduleMode: options.mark ? 'day' : 'repeat',
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
      await Promise.all([this._loadRooms(), this._loadEditSlot()]);
    } else if (this.data.formMeetId) {
      await Promise.all([this._loadRooms(), this._loadCourseMeta(this.data.formMeetId)]);
    } else {
      await this._loadRooms();
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
        const start = normalizeTime(slot.start, this.data.formStartTime);
        const end = normalizeTime(slot.end, this.data.formEndTime);
        patch.formStartTime = start;
        patch.formEndTime = end;
        patch.formTimeSlots = [{
          start,
          end,
        }];
        patch.formTeacherId = slot.teacherId || style.teacherId || '';
        patch.formTeacherName = slot.teacherName || style.teacherName || '';
        patch.formRoomId = slot.roomId || '';
        patch.formRoomName = slot.roomName || slot.room || '';
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

  async _loadRooms() {
    try {
      const data = await cloudHelper.callCloudData('admin/tenant_room_list', {}, { hint: false });
      const rooms = [{ id: '', name: '不指定教室' }].concat(
        ((data && data.rooms) || []).filter((item) => item.enabled !== false),
      );
      const selectedId = this.data.formRoomId;
      const index = rooms.findIndex((item) => item.id === selectedId);
      this.setData({
        roomOptions: rooms,
        formRoomPickerIndex: index >= 0 ? index : 0,
      });
    } catch (err) {
      console.warn('[schedule/rooms]', err);
      this.setData({ roomOptions: [] });
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
    const formStartTime = normalizeTime(this.data.formStartTime, '09:00');
    const formEndTime = scheduleSlotHelper.addMinutesToTime(
      formStartTime,
      this.data.duration,
    );
    const formTimeSlots = (this.data.formTimeSlots || []).map((slot) => ({
      ...slot,
      start: normalizeTime(slot.start, formStartTime),
      end: scheduleSlotHelper.addMinutesToTime(
        normalizeTime(slot.start, formStartTime),
        this.data.duration,
      ),
    }));
    this.setData({ formStartTime, formEndTime, formTimeSlots });
  },

  onCoachPick(e) {
    const { teacherId, teacherName } = e.detail || {};
    this.setData({
      formTeacherId: teacherId || '',
      formTeacherName: teacherName || '',
    });
  },

  bindRoomPickerOpen() {
    if (this.data.roomOptions.length > 1) this.setData({ roomPickerShow: true });
  },

  bindRoomPickerClose() {
    this.setData({ roomPickerShow: false });
  },

  bindRoomPick(e) {
    const index = Number(e.currentTarget.dataset.index);
    const room = this.data.roomOptions[index];
    if (!room) return;
    this.setData({
      roomPickerShow: false,
      formRoomId: room.id,
      formRoomName: room.name,
      formRoomPickerIndex: index,
      formLimit: !this.data.formLimit && Number(room.capacity) > 0
        ? String(room.capacity)
        : this.data.formLimit,
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
        formStartTime: normalizeTime(e.detail, this.data.formStartTime),
      },
      () => this._recalcEndTime(),
    );
  },

  bindBatchWeekdayTap(e) {
    const value = Number(e.currentTarget.dataset.value);
    const selected = new Set((this.data.batchWeekdays || []).map(Number));
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    const batchWeekdays = Array.from(selected).sort((a, b) => a - b);
    this.setData({ batchWeekdays, weekOptions: buildWeekOptions(batchWeekdays) });
  },

  bindScheduleModeTap(e) {
    const scheduleMode = e.currentTarget.dataset.mode;
    if (scheduleMode !== 'day' && scheduleMode !== 'repeat') return;
    this.setData({ scheduleMode });
  },

  bindBatchStartDayChange(e) {
    const batchStartDay = e.detail.value;
    const batchEndDay = this.data.batchEndDay < batchStartDay
      ? batchStartDay
      : this.data.batchEndDay;
    this.setData({ batchStartDay, batchEndDay });
  },

  bindBatchEndDayChange(e) {
    const batchEndDay = e.detail.value;
    if (batchEndDay < this.data.batchStartDay) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });
      return;
    }
    this.setData({ batchEndDay });
  },

  bindSlotStartChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const formTimeSlots = (this.data.formTimeSlots || []).map((slot, i) =>
      i === index
        ? { ...slot, start: normalizeTime(e.detail.value, slot.start || '09:00') }
        : slot,
    );
    this.setData({ formTimeSlots }, () => this._recalcEndTime());
  },

  bindAddTimeSlot() {
    const slots = (this.data.formTimeSlots || []).slice();
    if (slots.length >= 6) {
      wx.showToast({ title: '一次最多添加 6 个时段', icon: 'none' });
      return;
    }
    const last = slots[slots.length - 1] || { end: this.data.formEndTime || '10:00' };
    const start = last.end || '09:00';
    slots.push({ start, end: scheduleSlotHelper.addMinutesToTime(start, this.data.duration) });
    this.setData({ formTimeSlots: slots });
  },

  bindRemoveTimeSlot(e) {
    const index = Number(e.currentTarget.dataset.index);
    const slots = (this.data.formTimeSlots || []).slice();
    if (slots.length <= 1) {
      wx.showToast({ title: '至少保留一个上课时间', icon: 'none' });
      return;
    }
    slots.splice(index, 1);
    this.setData({ formTimeSlots: slots });
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
      formTimeSlots,
      formTeacherId,
      formTeacherName,
      formRoomId,
      formRoomName,
      formLimit,
      mark,
      isEdit,
    } = this.data;

    if (!formMeetId) {
      wx.showToast({ title: '请选择课程', icon: 'none' });
      return;
    }
    const isRepeat = !isEdit && this.data.scheduleMode === 'repeat';
    const targetDays = isEdit
      ? formDays.slice(0, 1)
      : isRepeat
        ? buildRepeatDays(
          this.data.batchStartDay,
          this.data.batchEndDay,
          this.data.batchWeekdays,
        )
        : formDays;
    if (!targetDays.length) {
      wx.showToast({
        title: isEdit || !isRepeat ? '请选择上课日期' : '请选择星期与排课日期范围',
        icon: 'none',
      });
      return;
    }
    if (isRepeat && !formTimeSlots.length) {
      wx.showToast({ title: '请添加上课时间', icon: 'none' });
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
        { id: formMeetId, fromDay: targetDays[0] },
        { title: 'bar' },
      );
      if (!meet) {
        wx.showToast({ title: '课程不存在', icon: 'none' });
        return;
      }

      const limit = Number(formLimit) || 0;
      let daysSet = meet.MEET_DAYS_SET || [];
      const targetSlots = isEdit || !isRepeat
        ? [{ start: formStartTime, end: formEndTime }]
        : formTimeSlots;

      for (const day of targetDays) {
        for (const slot of targetSlots) {
          daysSet = scheduleSlotHelper.upsertTimeSlot(daysSet, {
            day,
            start: slot.start,
            end: slot.end,
            limit,
            mark: isEdit ? mark : '',
          teacherId: formTeacherId,
          teacherName: formTeacherName,
          roomId: formRoomId,
          roomName: formRoomName,
          });
        }
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
        title: isEdit
          ? '已更新'
          : '已排 ' + targetDays.length * targetSlots.length + ' 个时段',
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
