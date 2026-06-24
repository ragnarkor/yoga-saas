const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const scheduleSlotHelper = require("../../../helper/schedule_slot_helper.js");

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  externalClasses: ["field-class"],

  properties: {
    value: { type: String, value: "" },
    themeColor: { type: String, value: "#5B8A72" },
    label: { type: String, value: "课程" },
    sheetTitle: { type: String, value: "选择课程" },
    placeholder: { type: String, value: "请选择课程" },
    emptyText: { type: String, value: "暂无课程" },
    required: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    /** 外部传入课程列表（私教 meta 等）；有值时不自动拉取 */
    courses: { type: Array, value: [] },
    /** admin_meet_list | private_admin | private_member | none */
    loadFrom: { type: String, value: "admin_meet_list" },
  },

  data: {
    sheetShow: false,
    loading: false,
    coursePickerList: [],
    rawCourseList: [],
    selectedCourse: null,
  },

  observers: {
    value(meetId) {
      this._syncSelected(meetId);
    },
    courses(list) {
      if (list && list.length) {
        this._setPickerList(list);
      } else if (this.data.loadFrom !== "none") {
        this._loadCourses();
      } else {
        this._setPickerList([]);
      }
    },
  },

  lifetimes: {
    attached() {
      if (this.data.courses && this.data.courses.length) {
        this._setPickerList(this.data.courses);
      } else if (this.data.loadFrom !== "none") {
        this._loadCourses();
      }
    },
  },

  methods: {
    _normalizeRawCourse(item, index) {
      if (!item) return null;
      if (item.MEET_TITLE || item.MEET_STYLE_SET) {
        return scheduleSlotHelper.formatCoursePickerItem(item, index);
      }
      return scheduleSlotHelper.formatPrivateCoursePickerItem(item, index);
    },

    _setPickerList(rawList) {
      const coursePickerList = (rawList || [])
        .map((item, index) => this._normalizeRawCourse(item, index))
        .filter(Boolean);
      this.setData({ coursePickerList, rawCourseList: rawList || [] });
      this._syncSelected(this.data.value);
    },

    _syncSelected(meetId) {
      if (!meetId) {
        this.setData({ selectedCourse: null });
        return;
      }
      const selectedCourse =
        this.data.coursePickerList.find((c) => String(c._id) === String(meetId)) ||
        null;
      this.setData({ selectedCourse });
    },

    async _loadCourses() {
      const loadFrom = this.data.loadFrom;
      if (loadFrom === "none") return;

      this.setData({ loading: true });
      try {
        let raw = [];
        if (loadFrom === "admin_meet_list") {
          const ok = await AdminWxBiz.ensureSession();
          if (!ok) {
            this.setData({ loading: false, coursePickerList: [], rawCourseList: [] });
            return;
          }
          const res = await cloudHelper.callCloudData(
            "admin/meet_list",
            { page: 1, size: 200 },
            { hint: false },
          );
          raw = (res && res.list) || [];
        } else if (loadFrom === "private_admin") {
          const ok = await AdminWxBiz.ensureSession();
          if (!ok) {
            this.setData({ loading: false, coursePickerList: [], rawCourseList: [] });
            return;
          }
          const res = await cloudHelper.callCloudData(
            "admin/private_meta",
            {},
            { hint: false },
          );
          raw = (res && res.courses) || [];
        } else if (loadFrom === "private_member") {
          const res = await cloudHelper.callCloudData(
            "private/meta",
            {},
            { hint: false },
          );
          raw = (res && res.courses) || [];
        }
        this._setPickerList(raw);
        this.setData({ loading: false });
      } catch (e) {
        console.error("[meet_course_picker] load error:", e);
        this.setData({ loading: false, coursePickerList: [], rawCourseList: [] });
      }
    },

    bindFieldTap() {
      if (this.data.disabled) return;
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      if (!this.data.coursePickerList.length) {
        wx.showToast({ title: this.data.emptyText, icon: "none" });
        if (this.data.loadFrom !== "none") this._loadCourses();
        return;
      }
      this.setData({ sheetShow: true });
    },

    bindCloseSheet() {
      this.setData({ sheetShow: false });
    },

    bindCoursePick(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      const index = this.data.coursePickerList.findIndex(
        (c) => String(c._id) === String(id),
      );
      const course = index >= 0 ? this.data.coursePickerList[index] : null;
      const meet = index >= 0 ? this.data.rawCourseList[index] : null;
      if (!course) return;
      this.setData({ sheetShow: false, selectedCourse: course });
      this.triggerEvent("pick", {
        meetId: course._id,
        course,
        meet,
      });
    },

    /** 供父页面在异步赋值 courses 后刷新列表 */
    reload() {
      if (this.data.courses && this.data.courses.length) {
        this._setPickerList(this.data.courses);
      } else {
        this._loadCourses();
      }
    },
  },
});
