const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const UserProfileBiz = require("../../../biz/user_profile_biz.js");

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  externalClasses: ["field-class"],

  properties: {
    value: { type: String, value: "" },
    themeColor: { type: String, value: "#5B8A72" },
    label: { type: String, value: "归属教练" },
    required: { type: Boolean, value: false },
    placeholder: { type: String, value: "请选择" },
    /** 默认选中的管理员 ID（如当前登录教练） */
    defaultCoachId: { type: String, value: "" },
    /** admin=归属教练(adminId)；teacher=授课教练(teacher._id) */
    idMode: { type: String, value: "admin" },
  },

  data: {
    coachList: [],
    selectedCoach: null,
    sheetShow: false,
    loading: false,
    displayText: "",
  },

  observers: {
    value(coachId) {
      this._syncSelected(coachId);
    },
    defaultCoachId(id) {
      if (id && !this.data.value && this.data.coachList.length) {
        this._applyDefault(id);
      }
    },
  },

  lifetimes: {
    attached() {
      this.setData({ displayText: this.data.placeholder });
      this._loadCoaches();
    },
  },

  methods: {
    async _loadCoaches() {
      this.setData({ loading: true });
      try {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ loading: false });
          return;
        }
        const res = await cloudHelper.callCloudData(
          "admin/home_teacher_list",
          {},
          { hint: false },
        );
        const rawList = (res && res.list) || [];
        const avatarUrls = rawList
          .map((t) => t.TEACHER_AVATAR || t.avatar || "")
          .filter(Boolean);
        const avatarMap = await UserProfileBiz.resolveAvatarUrlMap(avatarUrls);
        const idMode = this.data.idMode === "teacher" ? "teacher" : "admin";
        const coachList = rawList.map((t) => {
          const avatar = t.TEACHER_AVATAR || t.avatar || "";
          const coachId = t.TEACHER_ADMIN_ID || t._id;
          const teacherId = t._id;
          const pickId = idMode === "teacher" ? teacherId : coachId;
          return {
            pickId,
            coachId,
            teacherId,
            name: t.TEACHER_NAME || t.name || "",
            specialty: t.TEACHER_SPECIALTY || "",
            avatar,
            avatarSrc: avatar ? avatarMap[avatar] || "" : "",
          };
        });
        this.setData({ coachList, loading: false });
        if (this.data.value) {
          this._syncSelected(this.data.value);
        } else if (this.data.defaultCoachId) {
          this._applyDefault(this.data.defaultCoachId);
        }
      } catch (e) {
        console.error("coach_picker load error:", e);
        this.setData({ coachList: [], loading: false });
      }
    },

    _applyDefault(coachId) {
      const hit = this.data.coachList.find(
        (c) => c.pickId === coachId || c.coachId === coachId,
      );
      if (!hit) return;
      this._emitPick(hit);
    },

    _syncSelected(pickId) {
      if (!pickId) {
        this.setData({
          selectedCoach: null,
          displayText: this.data.placeholder,
        });
        return;
      }
      const selectedCoach =
        this.data.coachList.find(
          (c) => c.pickId === pickId || c.coachId === pickId || c.teacherId === pickId,
        ) || null;
      this.setData({
        selectedCoach,
        displayText: selectedCoach ? selectedCoach.name : this.data.placeholder,
      });
    },

    bindFieldTap() {
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      if (!this.data.coachList.length) {
        wx.showToast({ title: "暂无可用教练", icon: "none" });
        return;
      }
      this.setData({ sheetShow: true });
    },

    bindCloseSheet() {
      this.setData({ sheetShow: false });
    },

    bindCoachPick(e) {
      const pickId = e.currentTarget.dataset.id;
      const hit = this.data.coachList.find((c) => c.pickId === pickId);
      if (!hit) return;
      this.setData({ sheetShow: false });
      this._emitPick(hit);
    },

    _emitPick(coach) {
      this.setData({
        selectedCoach: coach,
        displayText: coach.name || this.data.placeholder,
      });
      this.triggerEvent("pick", {
        pickId: coach.pickId,
        coachId: coach.coachId,
        coachName: coach.name,
        teacherId: coach.teacherId,
        teacherName: coach.name,
        avatar: coach.avatar,
        coach,
      });
    },
  },
});
