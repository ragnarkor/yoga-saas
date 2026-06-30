const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');
const MeetBiz = require('../../../../biz/meet_biz.js');
const privateScheduleHelper = require('../../../../helper/private_schedule_helper.js');
const themeHelper = require('../../../../helper/theme_helper.js');
const themeBh = require('../../../../behavior/theme_bh.js');

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDayStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function buildDateList(maxBookDays) {
  const days = Math.max(1, Number(maxBookDays) || 14);
  const list = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = formatDayStr(d);
    list.push({
      day,
      shortLabel: pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()),
      weekday: WEEK_NAMES[d.getDay()],
    });
  }
  return list;
}

Page({
  behaviors: [themeBh],

  data: {
    loading: true,
    slotsLoading: false,
    submitting: false,
    themeColor: themeHelper.DEFAULT_THEME,
    courses: [],
    teachers: [],
    dateList: [],
    slots: [],
    joinCardOptions: [],
    cardSheetShow: false,
    cardPickLoading: false,
    selectedCardId: '',
    form: {
      meetId: '',
      courseName: '',
      teacherId: '',
      teacherName: '',
      day: '',
      dayDisplay: '',
      start: '',
      end: '',
      duration: 60,
    },
    scheduleHint: '',
    cardCanBook: true,
    cardHint: '',
    cardNeedTimes: 1,
    submitBtnText: '请先选择时段',
    pickerSheetOpen: false,
  },

  onLoad(options) {
    const themeColor = pageHelper.getThemeColor();
    this.setData({
      themeColor,
      pageStyle: themeHelper.getPageMetaStyle(themeColor),
      presetTeacherId: options.teacherId || '',
      presetMeetId: options.meetId || '',
    });
    this._initPage();
  },

  onShow() {
    if (typeof this._applyTheme === 'function') {
      this._applyTheme();
    }
  },

  async _initPage() {
    this.setData({ loading: true });
    try {
      try {
        await cloudHelper.callCloudSumbit('passport/ensure_member', {}, { hint: false });
      } catch (memberErr) {
        console.warn('[private_book/ensure_member]', memberErr);
      }
      const meta = await cloudHelper.callCloudData('private/meta', {}, { title: 'bar' });
      if (!meta || !(meta.courses || []).length) {
        this.setData({ loading: false, courses: [] });
        return;
      }

      const schedule = meta.schedule || {};
      const dateList = buildDateList(schedule.maxBookDays);
      const firstDay = dateList.length ? dateList[0].day : '';
      const courses = meta.courses || [];
      const teachers = meta.teachers || [];

      let formPatch = {
        day: firstDay,
        dayDisplay: firstDay ? privateScheduleHelper.buildDayDesc(firstDay) : '',
      };

      const presetMeetId = this.data.presetMeetId;
      const presetTeacherId = this.data.presetTeacherId;
      const course = presetMeetId
        ? courses.find((c) => String(c._id) === String(presetMeetId))
        : courses[0];
      if (course) {
        formPatch.meetId = course._id;
        formPatch.courseName = course.title;
        formPatch.duration = course.duration || 60;
      }

      const teacher = presetTeacherId
        ? teachers.find((t) => String(t._id) === String(presetTeacherId))
        : teachers.find((t) => course && String(t._id) === String(course.teacherId)) || teachers[0];
      if (teacher) {
        formPatch.teacherId = teacher._id;
        formPatch.teacherName = teacher.name;
      } else if (course && course.teacherId) {
        formPatch.teacherId = course.teacherId;
        formPatch.teacherName = course.teacherName || '';
      }

      const scheduleHint =
        '可选时段：' +
        (schedule.openTime || '07:00') +
        '–' +
        (schedule.closeTime || '22:00') +
        '，需提前 ' +
        (schedule.advanceHours != null ? schedule.advanceHours : 2) +
        ' 小时';

      this.setData({
        loading: false,
        courses,
        teachers,
        dateList,
        scheduleHint,
        form: Object.assign({}, this.data.form, formPatch),
      }, () => {
        this._syncCardNeedTimes(course);
        this._loadCardSummary();
        this._loadSlots();
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  _syncCardNeedTimes(course) {
    const needTimes =
      course && Number(course.cardTimes) > 0 ? Number(course.cardTimes) : 1;
    this.setData({ cardNeedTimes: needTimes });
    this._updateSubmitBtnText();
  },

  async _loadCardSummary() {
    try {
      const summary = await cloudHelper.callCloudData(
        'my/my_card_summary',
        {},
        { hint: false },
      );
      const canBook = !!(summary && summary.canBook);
      let cardHint = '';
      const needTimes = this.data.cardNeedTimes || 1;
      if (!canBook) {
        cardHint = `预约需扣 ${needTimes} 次会员卡，请联系馆方发卡`;
      } else if (summary.hasPeriod) {
        cardHint = `本次预约将划扣 ${needTimes} 次（期限内卡可畅练）`;
      } else if (summary.timesTotal > 0) {
        cardHint = `本次预约将划扣 ${needTimes} 次，可用次数合计 ${summary.timesTotal} 次`;
      } else {
        cardHint = `本次预约将划扣 ${needTimes} 次会员卡`;
      }
      this.setData({ cardCanBook: canBook, cardHint });
      this._updateSubmitBtnText();
    } catch (e) {
      console.error(e);
    }
  },

  _updateSubmitBtnText() {
    const { form, cardCanBook, cardNeedTimes } = this.data;
    let submitBtnText = '请先选择时段';
    if (!cardCanBook) {
      submitBtnText = '暂无可用会员卡';
    } else if (form.start) {
      submitBtnText = `确认预约 ${form.start}–${form.end}（扣${cardNeedTimes || 1}次）`;
    }
    this.setData({ submitBtnText });
  },

  async _loadSlots() {
    const { form } = this.data;
    if (!form.meetId || !form.teacherId || !form.day) {
      this.setData({ slots: [], 'form.start': '', 'form.end': '' });
      return;
    }

    this.setData({ slotsLoading: true, slots: [], 'form.start': '', 'form.end': '' });
    try {
      const res = await cloudHelper.callCloudData(
        'private/available_slots',
        {
          meetId: form.meetId,
          teacherId: form.teacherId,
          day: form.day,
        },
        { hint: false },
      );
      this.setData({
        slotsLoading: false,
        slots: (res && res.slots) || [],
        'form.duration': (res && res.duration) || form.duration,
      }, () => this._updateSubmitBtnText());
    } catch (e) {
      console.error(e);
      this.setData({ slotsLoading: false, slots: [] });
    }
  },

  onCoursePick(e) {
    const course = (e.detail && e.detail.meet) || (e.detail && e.detail.course);
    if (!course) return;
    const patch = {
      'form.meetId': course._id,
      'form.courseName': course.title || course.MEET_TITLE || '',
      'form.duration': course.duration || 60,
      'form.start': '',
      'form.end': '',
    };
    if (course.teacherId && !this.data.form.teacherId) {
      patch['form.teacherId'] = course.teacherId;
      patch['form.teacherName'] = course.teacherName || '';
    }
    this.setData(patch, () => {
      this._syncCardNeedTimes(course);
      this._loadCardSummary();
      this._loadSlots();
    });
  },

  onCoachPick(e) {
    const { teacherId, teacherName } = e.detail || {};
    this.setData({
      'form.teacherId': teacherId || '',
      'form.teacherName': teacherName || '',
      'form.start': '',
      'form.end': '',
    }, () => this._loadSlots());
  },

  onPickerSheetChange(e) {
    this.setData({ pickerSheetOpen: !!(e.detail && e.detail.show) });
  },

  bindDayTap(e) {
    const day = e.currentTarget.dataset.day;
    if (!day || day === this.data.form.day) return;
    this.setData({
      'form.day': day,
      'form.dayDisplay': privateScheduleHelper.buildDayDesc(day),
      'form.start': '',
      'form.end': '',
    }, () => this._loadSlots());
  },

  bindSlotTap(e) {
    const { start, end } = e.currentTarget.dataset;
    if (!start) return;
    this.setData({
      'form.start': start,
      'form.end': end || '',
    }, () => this._updateSubmitBtnText());
  },

  async bindSubmitTap() {
    if (this.data.submitting) return;
    const { form, cardCanBook, cardNeedTimes } = this.data;
    if (!form.meetId || !form.teacherId || !form.day || !form.start) {
      wx.showToast({ title: '请选择课程、教练和时段', icon: 'none' });
      return;
    }
    if (!cardCanBook) {
      wx.showModal({
        title: '提示',
        content: `预约私教需扣除 ${cardNeedTimes || 1} 次会员卡，您暂无可用会员卡，请联系馆方发卡。`,
        confirmText: '我的卡包',
        cancelText: '知道了',
        success(r) {
          if (r.confirm) {
            wx.navigateTo({ url: '/pages/default/my/card_pack/my_card_pack' });
          }
        },
      });
      return;
    }

    this.setData({ cardSheetShow: true, cardPickLoading: true, joinCardOptions: [], selectedCardId: '' });
    try {
      const res = await cloudHelper.callCloudData(
        'meet/join_card_options',
        { meetId: form.meetId },
        { title: 'bar' },
      );
      const list = (res && res.list) || [];
      if (!list.length) {
        this.setData({ cardSheetShow: false, cardPickLoading: false });
        wx.showModal({
          title: '提示',
          content: `暂无可用会员卡（需 ${this.data.cardNeedTimes || 1} 次），请联系馆方发卡。`,
          confirmText: '我的卡包',
          success(r) {
            if (r.confirm) {
              wx.navigateTo({ url: '/pages/default/my/card_pack/my_card_pack' });
            }
          },
        });
        return;
      }
      this.setData({
        joinCardOptions: list,
        cardPickLoading: false,
        cardNeedTimes: (res && res.needTimes) || this.data.cardNeedTimes || 1,
        selectedCardId: list.length === 1 ? list[0].id : '',
      });
    } catch (e) {
      console.error(e);
      this.setData({ cardSheetShow: false, cardPickLoading: false });
    }
  },

  bindCloseCardSheet() {
    this.setData({ cardSheetShow: false, selectedCardId: '' });
  },

  bindCardPick(e) {
    const cardId = e.currentTarget.dataset.id;
    if (!cardId) return;
    this.setData({ selectedCardId: cardId });
  },

  bindConfirmBookTap() {
    if (this.data.submitting || this._bookingLock) return;
    const cardId = this.data.selectedCardId;
    if (!cardId) {
      pageHelper.showNoneToast('请选择会员卡');
      return;
    }
    this._bookingLock = true;
    this.setData({ cardSheetShow: false, submitting: true });
    const callback = async () => {
      try {
        await this._submitBook(cardId);
      } finally {
        this._bookingLock = false;
      }
    };
    MeetBiz.subscribeMessageMeet(callback);
  },

  async _submitBook(cardId) {
    if (!cardId) return;
    const { form } = this.data;
    this.setData({ submitting: true });
    try {
      const res = await cloudHelper.callCloudSumbit(
        'private/book',
        {
          meetId: form.meetId,
          teacherId: form.teacherId,
          teacherName: form.teacherName,
          day: form.day,
          start: form.start,
          cardId,
        },
        { title: '预约中' },
      );
      const joinId = res && res.data && res.data.joinId;
      const cardWarning = res && res.data && res.data.cardWarning;
      let content = '预约成功！';
      if (cardWarning) {
        content += '\n\n' + cardWarning;
      }
      wx.showModal({
        title: '温馨提示',
        content,
        showCancel: false,
        success() {
          if (joinId) {
            wx.redirectTo({
              url: pageHelper.fmtURLByPID(
                '/pages/default/my/join_detail/my_join_detail?flag=home&id=' + joinId,
              ),
            });
          } else {
            wx.navigateTo({
              url: '/pages/default/my/join/my_join',
            });
          }
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
