const pageHelper = require('../helper/page_helper.js');
const dataHelper = require('../helper/data_helper.js');
const timeHelper = require('../helper/time_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const AdminMeetBiz = require('../biz/admin_meet_biz.js');
const setting = require('../setting/setting.js');

module.exports = Behavior({
  data: {
    daysTimeOptions: AdminMeetBiz.getDaysTimeOptions(),
    multiDoDay: [],
    hasDays: [],
    lastHasDays: [],
    hasJoinDays: [],
    days: [],
    curIdx: -1,
    curTimesIdx: -1,
    curTimeLimitModalShow: false,
    curTimeIsLimit: false,
    curTimeLimit: 50,
    saveTempModalShow: false,
    formTempName: '',
    cancelModalShow: false,
    formReason: '',
    topShow: false,
    minDate: new Date().getTime(),
    calendarDefaultDate: [],
    calendarColor: '#4a7c8c',
    timePickerShow: false,
    timePickerType: 'start',
    timePickerIdx: 0,
    timePickerTimesIdx: 0,
    timePickerValue: '',
    dayActionShow: false,
    dayActionIdx: -1,
    dayActions: [
      { name: '选用模板配置' },
      { name: '保存为模板' },
      { name: '删除该日期' },
      { name: '复制到所有日期' },
    ],
    timeSetActionShow: false,
    timeSetActionIdx: -1,
    timeSetActions: [
      { name: '复制到所有日期' },
      { name: '选用模板配置' },
      { name: '保存为模板' },
    ],
  },

  methods: {
    _getMeetTimeParent() {
      const p1 = pageHelper.getPrevPage(1);
      if (p1 && (p1.data.formDaysSet || p1.data.id)) return p1;
      return pageHelper.getPrevPage(2);
    },

    _initDaysFromParent(parent) {
      if (!parent || !parent.data) return;
      const formDaysSet = parent.data.formDaysSet || [];
      const days = [];
      const lastHasDays = [];
      const hasJoinDays = [];
      const now = timeHelper.time('Y-M-D');

      for (let k in formDaysSet) {
        if (formDaysSet[k].day < now) {
          lastHasDays.push(formDaysSet[k]);
        } else {
          days.push(formDaysSet[k]);
          if (this._checkHasJoinCnt(formDaysSet[k].times)) {
            hasJoinDays.push(formDaysSet[k].day);
          }
        }
      }

      this.setData({
        hasDays: dataHelper.getArrByKey(lastHasDays, 'day'),
        lastHasDays,
        hasJoinDays,
        days,
      });
      this._syncCalData();
    },

    _dayStrToDate(str) {
      const parts = str.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    },

    _dayDateToStr(date) {
      const d = date instanceof Date ? date : new Date(date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return (
        y +
        '-' +
        (m < 10 ? '0' + m : m) +
        '-' +
        (day < 10 ? '0' + day : day)
      );
    },

    _timeStrToMs(str) {
      const parts = (str || '00:00').split(':');
      const d = new Date();
      d.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
      return d.getTime();
    },

    _timeMsToStr(ms) {
      const d = new Date(ms);
      const h = d.getHours();
      const m = d.getMinutes();
      return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
    },

    _checkHasJoinCnt(times) {
      if (!times) return false;
      for (let k in times) {
        if (times[k].stat.succCnt || times[k].stat.waitCheckCnt) return true;
      }
      return false;
    },

    _syncCalData() {
      const days = this.data.days;
      const multiDoDay = dataHelper.getArrByKey(days, 'day');
      const calendarDefaultDate = multiDoDay.map((d) =>
        this._dayStrToDate(d).getTime(),
      );
      this.setData({ multiDoDay, calendarDefaultDate });
    },

    _applySelectedDays(clickDays) {
      if (!clickDays || !clickDays.length) {
        this.setData({ days: [] });
        this._syncCalData();
        return;
      }

      const days = this.data.days;
      const retDays = [];
      for (let k in clickDays) {
        let dayExist = false;
        for (let j in days) {
          if (days[j].day == clickDays[k]) {
            retDays.push(days[j]);
            dayExist = true;
            break;
          }
        }
        if (!dayExist) {
          const dayDesc =
            timeHelper.fmtDateCHN(clickDays[k]) +
            ' (' +
            timeHelper.week(clickDays[k]) +
            ')';
          retDays.push({
            day: clickDays[k],
            dayDesc,
            times: [AdminMeetBiz.getNewTimeNode(clickDays[k])],
          });
        }
      }
      this.setData({ days: retDays });
      this._syncCalData();
    },

    bindCalendarConfirm(e) {
      const dates = e.detail || [];
      const clickDays = dates.map((d) => this._dayDateToStr(d));
      this._applySelectedDays(clickDays);
    },

    bindDataCalendarClickCmpt(e) {
      const clickDays = e.detail.days;
      if (!clickDays) return;
      this._applySelectedDays(clickDays);
    },

    bindTimeAddTap(e) {
      const idx = pageHelper.dataset(e, 'idx');
      const days = this.data.days;
      if (days[idx].times.length >= 20) {
        return pageHelper.showModal('最多可以添加20个时段');
      }
      days[idx].times.push(AdminMeetBiz.getNewTimeNode(days[idx].day));
      this.setData({ days });
    },

    bindOpenTimePicker(e) {
      const idx = pageHelper.dataset(e, 'idx');
      const timesIdx = pageHelper.dataset(e, 'timesidx');
      const type = pageHelper.dataset(e, 'type') || 'start';
      const node = this.data.days[idx].times[timesIdx];
      if (node.stat.succCnt || node.stat.waitCheckCnt) {
        return pageHelper.showModal(
          '该时段已有用户预约/预约待审核，不可更改起止时间',
        );
      }
      const timeStr = type === 'end' ? node.end : node.start;
      this.setData({
        timePickerShow: true,
        timePickerType: type,
        timePickerIdx: idx,
        timePickerTimesIdx: timesIdx,
        timePickerValue: this._timeStrToMs(timeStr),
      });
    },

    bindTimePickerConfirm(e) {
      const val = this._timeMsToStr(e.detail);
      const { timePickerIdx, timePickerTimesIdx, timePickerType } = this.data;
      const days = this.data.days;
      const node = days[timePickerIdx].times[timePickerTimesIdx];

      if (timePickerType === 'start') {
        if (val >= node.end) {
          return pageHelper.showModal('开始时间不能大于等于结束时间');
        }
        node.start = val;
      } else {
        if (node.start >= val) {
          return pageHelper.showModal('开始时间不能大于等于结束时间');
        }
        node.end = val;
      }

      this.setData({ days, timePickerShow: false });
    },

    bindTimePickerClose() {
      this.setData({ timePickerShow: false });
    },

    bindCancelMeetJoinCmpt() {
      const curIdx = this.data.curIdx;
      const curTimesIdx = this.data.curTimesIdx;
      const days = this.data.days;
      const parent = this._getMeetTimeParent();
      if (!parent) return;

      cloudHelper
        .callCloudSumbit(
          'admin/meet_cancel_time_join',
          {
            reason: this.data.formReason,
            meetId: parent.data.id,
            timeMark: days[curIdx].times[curTimesIdx].mark,
          },
          { title: '预约记录取消中' },
        )
        .then(() => {
          days[curIdx].times.splice(curTimesIdx, 1);
          this.setData({ days, cancelModalShow: false, formReason: '' });
          this._setHasJoinDays();
          pageHelper.showSuccToast('取消成功', 1500);
        })
        .catch((err) => console.log(err));
    },

    bindTimeDelTap(e) {
      const idx = pageHelper.dataset(e, 'idx');
      const timesIdx = pageHelper.dataset(e, 'timesidx');
      const days = this.data.days;
      const node = days[idx].times[timesIdx];

      if (node.stat.succCnt || node.stat.waitCheckCnt) {
        pageHelper.showConfirm(
          '该时段已有「' +
            (node.stat.succCnt + node.stat.waitCheckCnt) +
            '人」预约/预约待审核，若选择删除则将取消所有预约，请仔细确认！',
          () => {
            this.setData({
              formReason: '',
              curIdx: idx,
              curTimesIdx: timesIdx,
              cancelModalShow: true,
            });
          },
        );
      } else {
        pageHelper.showConfirm('是否要删除该时间段？', () => {
          days[idx].times.splice(timesIdx, 1);
          this.setData({ days });
        });
      }
    },

    bindTimeStatusSwitchChange(e) {
      const idx = pageHelper.dataset(e, 'idx');
      const timesIdx = pageHelper.dataset(e, 'timesidx');
      const days = this.data.days;
      const checked = e.detail;

      if (checked) {
        days[idx].times[timesIdx].status = 1;
        this.setData({ days });
        return;
      }

      const snapshot = dataHelper.deepClone(days);
      pageHelper.showConfirm(
        '是否要停止该时间段的预约？停止后，已有预约记录仍将保留',
        () => {
          days[idx].times[timesIdx].status = 0;
          this.setData({ days });
        },
        () => {
          this.setData({ days: snapshot });
        },
      );
    },

    bindLimitSwitchChange(e) {
      this.setData({ curTimeIsLimit: e.detail });
    },

    bindLimitInputChange(e) {
      this.setData({ curTimeLimit: Number(e.detail) || 0 });
    },

    bindCloseLimitPopup() {
      this.setData({ curTimeLimitModalShow: false });
    },

    bindSaveTempCmpt() {
      const name = this.data.formTempName;
      if (name.length <= 0) return pageHelper.showNoneToast('请填写模板名称');
      if (name.length > 20) {
        return pageHelper.showNoneToast('模板名称不能超过20个字哦');
      }

      const days = this.data.days;
      const times = days[this.data.curIdx].times;
      if (times.length <= 0) {
        return pageHelper.showNoneToast('至少需要包含一个时段');
      }

      cloudHelper
        .callCloudSumbit(
          'admin/temp_insert',
          {
            name,
            times: times.map((t) => ({
              start: t.start,
              end: t.end,
              isLimit: t.isLimit,
              limit: t.limit,
            })),
          },
          { title: '模板保存中' },
        )
        .then(() => {
          pageHelper.showSuccToast('保存成功');
          this.setData({ saveTempModalShow: false, formTempName: '' });
        })
        .catch((err) => console.log(err));
    },

    bindTimeLimitSetCmpt() {
      const days = this.data.days;
      const idx = this.data.curIdx;
      const timesIdx = this.data.curTimesIdx;

      if (this.data.curTimesIdx == -1) {
        for (let k in days[idx].times) {
          days[idx].times[k].isLimit = this.data.curTimeIsLimit;
          days[idx].times[k].limit = this.data.curTimeLimit;
        }
      } else {
        const node = days[idx].times[timesIdx];
        node.isLimit = this.data.curTimeIsLimit;
        node.limit = this.data.curTimeLimit;
        days[idx].times[timesIdx] = node;
      }

      this.setData({ days, curTimeLimitModalShow: false });
    },

    bindShowTimeLimitModalTap(e) {
      const curIdx = pageHelper.dataset(e, 'idx');
      const curTimesIdx = pageHelper.dataset(e, 'timesidx');
      const days = this.data.days;

      if (curTimesIdx == -1) {
        this.setData({
          curIdx,
          curTimesIdx: -1,
          curTimeIsLimit: false,
          curTimeLimit: 50,
          curTimeLimitModalShow: true,
        });
      } else {
        const node = days[curIdx].times[curTimesIdx];
        this.setData({
          curIdx,
          curTimesIdx,
          curTimeIsLimit: node.isLimit,
          curTimeLimit: node.limit,
          curTimeLimitModalShow: true,
        });
      }
    },

    _selectTemp(e) {
      const curIdx = pageHelper.dataset(e, 'idx');
      if (this._checkHasJoinCnt(this.data.days[curIdx].times)) {
        return pageHelper.showModal(
          '该日已有用户预约/预约待审核，不能选用模板。请先删除有预约的时段',
        );
      }
      this.setData({ curIdx });
      wx.navigateTo({ url: '/pages/admin/meet/temp/admin_temp_select' });
    },

    _saveTempModal(e) {
      const curIdx = pageHelper.dataset(e, 'idx');
      const days = this.data.days;
      if (days[curIdx].times.length <= 0) {
        return pageHelper.showModal('该日期下没有设置时段，无法保存为模板');
      }
      this.setData({ saveTempModalShow: true, curIdx });
    },

    _copyDaySetToAll(e) {
      const curIdx = pageHelper.dataset(e, 'idx');
      const days = this.data.days;
      const day = days[curIdx].day;
      const temps = days[curIdx].times;

      pageHelper.showConfirm(
        '确认将「' +
          day +
          '」下的时段设置复制到其他日期下吗? (原有时段将被清除，如已有预约记录则该日的所有时段将不被修改)',
        () => {
          for (let k in days) {
            if (this._checkHasJoinCnt(days[k].times)) continue;
            const times = [];
            for (let j in temps) {
              const node = AdminMeetBiz.getNewTimeNode(days[k].day);
              node.start = temps[j].start;
              node.end = temps[j].end;
              node.limit = temps[j].limit;
              node.isLimit = temps[j].isLimit;
              times.push(node);
            }
            days[k].times = times;
          }
          this.setData({ days });
        },
      );
    },

    bindDaySetTap(e) {
      this.setData({
        dayActionShow: true,
        dayActionIdx: pageHelper.dataset(e, 'idx'),
      });
    },

    bindDayActionSelect(e) {
      const name = e.detail.name;
      const idx = this.data.dayActions.findIndex((a) => a.name === name);
      const fakeE = { currentTarget: { dataset: { idx: this.data.dayActionIdx } } };
      this.setData({ dayActionShow: false });

      if (idx === 0) this._selectTemp(fakeE);
      if (idx === 1) this._saveTempModal(fakeE);
      if (idx === 2) {
        const curIdx = this.data.dayActionIdx;
        if (this._checkHasJoinCnt(this.data.days[curIdx].times)) {
          return pageHelper.showModal(
            '该日已有用户预约/预约待审核，不能直接删除。请先删除有预约的时段',
          );
        }
        pageHelper.showConfirm('确认删除该日期吗?', () => {
          const days = this.data.days;
          days.splice(curIdx, 1);
          this.setData({ days });
          this._syncCalData();
        });
      }
      if (idx === 3) this._copyDaySetToAll(fakeE);
    },

    bindDayActionClose() {
      this.setData({ dayActionShow: false });
    },

    bindTimeSetTap(e) {
      this.setData({
        timeSetActionShow: true,
        timeSetActionIdx: pageHelper.dataset(e, 'idx'),
      });
    },

    bindTimeSetActionSelect(e) {
      const name = e.detail.name;
      const idx = this.data.timeSetActions.findIndex((a) => a.name === name);
      const fakeE = {
        currentTarget: { dataset: { idx: this.data.timeSetActionIdx } },
      };
      this.setData({ timeSetActionShow: false });
      if (idx === 0) this._copyDaySetToAll(fakeE);
      if (idx === 1) this._selectTemp(fakeE);
      if (idx === 2) this._saveTempModal(fakeE);
    },

    bindTimeSetActionClose() {
      this.setData({ timeSetActionShow: false });
    },

    bindCloseCancelPopup() {
      this.setData({ cancelModalShow: false, formReason: '' });
    },

    bindCloseTempPopup() {
      this.setData({ saveTempModalShow: false, formTempName: '' });
    },

    bindTempNameChange(e) {
      this.setData({ formTempName: e.detail });
    },

    bindReasonChange(e) {
      this.setData({ formReason: e.detail });
    },

    bindClearReasonTap() {
      this.setData({ formReason: '' });
    },

    bindTopTap() {
      wx.pageScrollTo({ scrollTop: 0 });
    },

    onPageScroll(e) {
      this.setData({ topShow: e.scrollTop > 100 });
    },

    bindSaveTap() {
      const parent = this._getMeetTimeParent();
      if (!parent) {
        pageHelper.showNoneToast('前序页面不存在');
        return;
      }

      let getDays = [];
      const days = this.data.days;
      if (!setting.MEET_CAN_NULL_TIME) {
        for (let k in days) {
          if (days[k].times.length > 0) getDays.push(days[k]);
        }
      } else {
        getDays = days;
      }

      parent.setData({ formDaysSet: this.data.lastHasDays.concat(getDays) });
      wx.navigateBack({ delta: 0 });
    },

    bindBackTap() {
      wx.navigateBack();
    },

    _setHasJoinDays() {
      const days = this.data.days;
      const now = timeHelper.time('Y-M-D');
      const hasJoinDays = [];
      for (let k in days) {
        if (days[k].day >= now && this._checkHasJoinCnt(days[k].times)) {
          hasJoinDays.push(days[k].day);
        }
      }
      this.setData({ hasJoinDays });
    },
  },
});
