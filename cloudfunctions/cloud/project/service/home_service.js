/**
 * Notes: 全局/首页模块业务逻辑
 */

const BaseService = require("./base_service.js");
const SetupModel = require("../model/setup_model.js");
const BannerModel = require("../model/banner_model.js");
const AnnouncementModel = require("../model/announcement_model.js");
const TeacherModel = require("../model/teacher_model.js");
const PhotoModel = require("../model/photo_model.js");
const NewsModel = require("../model/news_model.js");
const MeetModel = require("../model/meet_model.js");
const DayModel = require("../model/day_model.js");
const AdminModel = require("../model/admin_model.js");
const teacherAdminHelper = require("./teacher_admin_helper.js");
const dataUtil = require("../../framework/utils/data_util.js");
const timeUtil = require("../../framework/utils/time_util.js");
const dbUtil = require("../../framework/database/db_util.js");
const cloudUtil = require("../../framework/cloud/cloud_util.js");

const HOME_COLLECTIONS = [
  "ax_banner",
  "ax_announcement",
  "ax_teacher",
  "ax_photo",
];

const DEFAULT_FEATURES = {
  booking: true,
  payment: false,
  teacherManage: true,
  checkin: true,
  news: true,
  selfCheckin: true,
};

class HomeService extends BaseService {
  async getSetup(fields = "*") {
    let where = {};
    let setup = await SetupModel.getOne(where, fields);

    if (!setup) {
      let data = {
        SETUP_ABOUT: "关于我们",
        SETUP_PHONE: "",
        SETUP_FEATURES: DEFAULT_FEATURES,
      };
      await SetupModel.insert(data);
      setup = await SetupModel.getOne(where, fields);
    }
    return setup;
  }

  async _ensureHomeCollections() {
    for (let cl of HOME_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  async _safeGetAll(model, where, fields, orderBy, size = 100) {
    try {
      return await model.getAll(where, fields, orderBy, size);
    } catch (err) {
      console.error("[home/index] query failed:", model.CL, err.message);
      return [];
    }
  }

  async _fmtMediaUrl(url) {
    if (!url || typeof url !== "string") return "";
    if (
      url.indexOf("http://") === 0 ||
      url.indexOf("https://") === 0 ||
      url.indexOf("/") === 0
    ) {
      return url;
    }
    if (url.indexOf("cloud://") === 0) {
      try {
        return await cloudUtil.getTempFileURLOne(url);
      } catch (err) {
        console.error("[home/index] temp url failed:", url, err.message);
        return url;
      }
    }
    return url;
  }

  async _fmtMediaUrls(list) {
    if (!list || !list.length) return [];
    let cloudIds = list.filter(
      (url) => url && typeof url === "string" && url.indexOf("cloud://") === 0,
    );
    if (!cloudIds.length) {
      return list.map((url) => this._fmtMediaUrlSync(url));
    }
    try {
      let tempUrls = await cloudUtil.getTempFileURL(cloudIds);
      let map = {};
      for (let i in cloudIds) map[cloudIds[i]] = tempUrls[i] || cloudIds[i];
      return list.map((url) => {
        if (url && url.indexOf("cloud://") === 0) return map[url] || url;
        return this._fmtMediaUrlSync(url);
      });
    } catch (err) {
      console.error("[home/index] batch temp url failed:", err.message);
      return list.map((url) => this._fmtMediaUrlSync(url));
    }
  }

  _fmtMediaUrlSync(url) {
    if (!url || typeof url !== "string") return "";
    if (
      url.indexOf("http://") === 0 ||
      url.indexOf("https://") === 0 ||
      url.indexOf("/") === 0
    ) {
      return url;
    }
    return url;
  }

  async getHomeIndex() {
    let setup = await this.getSetup("SETUP_PHONE");
    let phone = setup ? setup.SETUP_PHONE || "" : "";

    let [rawBanners, rawAnnounces, rawPhotos] = await Promise.all([
      this._safeGetAll(
        BannerModel,
        { BANNER_STATUS: 1 },
        "BANNER_TITLE,BANNER_TYPE,BANNER_PIC,BANNER_VIDEO,BANNER_LINK_TYPE,BANNER_LINK_ID",
        { BANNER_ORDER: "asc", BANNER_ADD_TIME: "desc" },
        20,
      ),
      this._safeGetAll(
        AnnouncementModel,
        { ANNOUNCE_STATUS: 1 },
        "ANNOUNCE_TITLE,ANNOUNCE_DESC",
        { ANNOUNCE_ORDER: "asc", ANNOUNCE_ADD_TIME: "desc" },
        10,
      ),
      this._safeGetAll(
        PhotoModel,
        { PHOTO_STATUS: 1 },
        "PHOTO_TITLE,PHOTO_DESC,PHOTO_PIC,PHOTO_LINK_TYPE,PHOTO_LINK_ID",
        { PHOTO_ORDER: "asc", PHOTO_ADD_TIME: "desc" },
        30,
      ),
    ]);

    let rawTeachers = await teacherAdminHelper.listBoundStaffForHome();

    let banners = rawBanners.map((item) => ({
      _id: item._id,
      pic: this._fmtMediaUrlSync(item.BANNER_PIC),
      video: this._fmtMediaUrlSync(item.BANNER_VIDEO),
      linkType: item.BANNER_LINK_TYPE || "none",
      linkId: item.BANNER_LINK_ID || "",
      type: item.BANNER_TYPE || "image",
      title: item.BANNER_TITLE || "",
    }));

    let announcements = rawAnnounces.map((item) => ({
      _id: item._id,
      title: item.ANNOUNCE_TITLE,
      desc: item.ANNOUNCE_DESC || "",
    }));

    let teachers = rawTeachers.map((item) => {
      let pics = (item.TEACHER_PIC || []).map((url) =>
        this._fmtMediaUrlSync(url),
      );
      let avatar = this._fmtMediaUrlSync(item.TEACHER_AVATAR);
      return {
        _id: item._id,
        name: item.TEACHER_NAME,
        avatar,
        specialty: item.TEACHER_SPECIALTY || "",
        desc: item.TEACHER_DESC || "",
        pics,
        cover: pics[0] || avatar,
      };
    });

    let photos = rawPhotos.map((item) => ({
      _id: item._id,
      pic: this._fmtMediaUrlSync(item.PHOTO_PIC),
      title: item.PHOTO_TITLE || "",
      desc: item.PHOTO_DESC || "",
      album: (item.PHOTO_DESC || "").trim() || "馆舍风采",
      linkType: item.PHOTO_LINK_TYPE || "none",
      linkId: item.PHOTO_LINK_ID || "",
    }));

    let photoAlbums = this._buildPhotoAlbums(photos);

    return { phone, banners, announcements, teachers, photos, photoAlbums };
  }

  _buildPhotoAlbums(photos) {
    if (!photos || !photos.length) return [];
    let map = {};
    let idx = 0;
    for (let item of photos) {
      let key = item.album || "馆舍风采";
      if (!map[key]) {
        map[key] = { id: String(idx++), title: key, photos: [] };
      }
      map[key].photos.push(item);
    }
    return Object.values(map);
  }

  async getTeacherDetail(id) {
    let teacher = await TeacherModel.getOne(
      { _id: id },
      "TEACHER_NAME,TEACHER_AVATAR,TEACHER_PIC,TEACHER_SPECIALTY,TEACHER_DESC,TEACHER_ADMIN_ID,TEACHER_HOME,TEACHER_STATUS",
    );
    if (!teacher) return null;
    if (!(await teacherAdminHelper.isTeacherVisibleOnHome(teacher))) return null;

    return {
      _id: teacher._id,
      name: teacher.TEACHER_NAME,
      avatar: await this._fmtMediaUrl(teacher.TEACHER_AVATAR),
      specialty: teacher.TEACHER_SPECIALTY || "",
      desc: teacher.TEACHER_DESC || "",
      pics: await this._fmtMediaUrls(teacher.TEACHER_PIC || []),
      adminId: teacher.TEACHER_ADMIN_ID || "",
    };
  }

  _parseMeetCategories(meetTypeStr) {
    let opts = dataUtil.getSelectOptions(meetTypeStr || "");
    let tabs = [{ id: "0", name: "全部课程" }];
    for (let o of opts) {
      if (!o || o.val == null || !o.label) continue;
      let name = String(o.label).split("|")[0];
      tabs.push({ id: String(o.val), name });
    }
    return tabs;
  }

  _meetBelongsToTeacher(meet, teacherId, adminId) {
    if (!meet) return false;
    if (adminId && meet.MEET_ADMIN_ID === adminId) return true;
    let style = meet.MEET_STYLE_SET || {};
    if (teacherId && style.teacherId === teacherId) return true;
    return false;
  }

  /** 老师主页：资料 + 课程分类 + 可预约排课 */
  async getTeacherHome(id, typeId) {
    let teacher = await TeacherModel.getOne(
      { _id: id },
      "TEACHER_NAME,TEACHER_AVATAR,TEACHER_PIC,TEACHER_SPECIALTY,TEACHER_DESC,TEACHER_ADMIN_ID,TEACHER_HOME,TEACHER_STATUS",
    );
    if (!teacher) return null;
    if (!(await teacherAdminHelper.isTeacherVisibleOnHome(teacher))) return null;

    let adminId = teacher.TEACHER_ADMIN_ID || "";
    let setup = await this.getSetup("SETUP_MEET_TYPE");
    let categories = this._parseMeetCategories(
      setup && setup.SETUP_MEET_TYPE ? setup.SETUP_MEET_TYPE : "",
    );

    let meets = await this._safeGetAll(
      MeetModel,
      { MEET_STATUS: MeetModel.STATUS.COMM },
      "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET,MEET_ADMIN_ID,MEET_IS_SHOW_LIMIT",
      { MEET_ORDER: "asc", MEET_ADD_TIME: "desc" },
      200,
    );

    meets = (meets || []).filter((m) =>
      this._meetBelongsToTeacher(m, teacher._id, adminId),
    );

    if (!meets.length) {
      return {
        teacher: {
          _id: teacher._id,
          name: teacher.TEACHER_NAME,
          avatar: await this._fmtMediaUrl(teacher.TEACHER_AVATAR),
          specialty: teacher.TEACHER_SPECIALTY || "",
          desc: teacher.TEACHER_DESC || "",
          pics: await this._fmtMediaUrls(teacher.TEACHER_PIC || []),
          adminId,
        },
        categories,
        sessions: [],
      };
    }

    let meetMap = {};
    let meetIds = [];
    for (let m of meets) {
      meetMap[m._id] = m;
      meetIds.push(m._id);
    }

    let today = timeUtil.time("Y-M-D");
    let dayRecords = await DayModel.getAllBig(
      {
        DAY_MEET_ID: ["in", meetIds],
        day: [">=", today],
      },
      "DAY_MEET_ID,day,dayDesc,times",
      { day: "asc", DAY_ADD_TIME: "asc" },
      500,
    );

    let filterType = typeId && typeId !== "0" ? String(typeId) : "";
    let sessions = [];

    for (let rec of dayRecords || []) {
      let meet = meetMap[rec.DAY_MEET_ID];
      if (!meet) continue;
      if (filterType && String(meet.MEET_TYPE_ID) !== filterType) continue;

      let style = meet.MEET_STYLE_SET || {};
      let times = rec.times || [];
      let weekLabel = timeUtil.week(rec.day);

      for (let t of times) {
        if (!t || t.status != 1) continue;

        let limit = Number(t.limit) || 0;
        let succCnt =
          t.stat && t.stat.succCnt ? Number(t.stat.succCnt) : 0;
        let slotsLeft = limit > 0 ? Math.max(0, limit - succCnt) : 99;
        let isShowLimit = meet.MEET_IS_SHOW_LIMIT !== 0;
        let level = Number(style.difficulty || style.level || 3);
        if (level < 1) level = 1;
        if (level > 5) level = 5;

        sessions.push({
          meetId: meet._id,
          title: meet.MEET_TITLE,
          pic: this._fmtMediaUrlSync(style.pic || ""),
          typeId: meet.MEET_TYPE_ID,
          typeName: meet.MEET_TYPE_NAME || "",
          day: rec.day,
          dayDesc: rec.dayDesc || weekLabel,
          weekLabel,
          timeStart: t.start || "",
          timeEnd: t.end || "",
          timeMark: t.mark || "",
          dateTimeText: `${rec.day} (${weekLabel}) ${t.start || ""}-${t.end || ""}`,
          level,
          levelStars: [1, 2, 3, 4, 5].map((i) => (i <= level ? 1 : 0)),
          limit,
          succCnt,
          slotsLeft,
          isShowLimit,
          slotsText:
            !isShowLimit || limit <= 0
              ? "开放预约"
              : slotsLeft > 0
                ? `还可以预约${slotsLeft}人`
                : "已满员",
          status: limit > 0 && slotsLeft <= 0 ? "full" : "available",
        });
      }
    }

    sessions.sort((a, b) => {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      return (a.timeStart || "").localeCompare(b.timeStart || "");
    });

    return {
      teacher: {
        _id: teacher._id,
        name: teacher.TEACHER_NAME,
        avatar: await this._fmtMediaUrl(teacher.TEACHER_AVATAR),
        specialty: teacher.TEACHER_SPECIALTY || "",
        desc: teacher.TEACHER_DESC || "",
        pics: await this._fmtMediaUrls(teacher.TEACHER_PIC || []),
        adminId,
      },
      categories,
      sessions,
    };
  }

  async getAnnounceDetail(id) {
    let item = await AnnouncementModel.getOne(
      { _id: id, ANNOUNCE_STATUS: 1 },
      "ANNOUNCE_TITLE,ANNOUNCE_DESC,ANNOUNCE_CONTENT",
    );
    if (!item) return null;
    return {
      _id: item._id,
      title: item.ANNOUNCE_TITLE,
      desc: item.ANNOUNCE_DESC || "",
      content: item.ANNOUNCE_CONTENT || [],
    };
  }

  async searchHome(keyword) {
    if (!keyword) {
      return { meetList: [], newsList: [], teacherList: [] };
    }

    let meetWhere = {
      MEET_STATUS: ["in", [MeetModel.STATUS.COMM, MeetModel.STATUS.OVER]],
      MEET_TITLE: { $regex: ".*" + keyword, $options: "i" },
    };
    let meetList = await this._safeGetAll(
      MeetModel,
      meetWhere,
      "MEET_TITLE,MEET_STYLE_SET,MEET_TYPE_NAME",
      { MEET_ORDER: "asc" },
      10,
    );
    meetList = await Promise.all(
      meetList.map(async (item) => ({
        _id: item._id,
        type: "meet",
        title: item.MEET_TITLE,
        desc: (item.MEET_STYLE_SET && item.MEET_STYLE_SET.desc) || "",
        pic: await this._fmtMediaUrl(
          (item.MEET_STYLE_SET && item.MEET_STYLE_SET.pic) || "",
        ),
      })),
    );

    let newsWhere = {
      NEWS_STATUS: 1,
      NEWS_TITLE: { $regex: ".*" + keyword, $options: "i" },
    };
    let newsList = await this._safeGetAll(
      NewsModel,
      newsWhere,
      "NEWS_TITLE,NEWS_DESC,NEWS_PIC,NEWS_CATE_NAME",
      { NEWS_ORDER: "asc" },
      10,
    );
    newsList = await Promise.all(
      newsList.map(async (item) => ({
        _id: item._id,
        type: "news",
        title: item.NEWS_TITLE,
        desc: item.NEWS_DESC || "",
        pic: await this._fmtMediaUrl(
          (item.NEWS_PIC && item.NEWS_PIC[0]) || "",
        ),
      })),
    );

    let teacherList = await teacherAdminHelper.listBoundStaffForHome();
    if (keyword) {
      const kw = keyword.toLowerCase();
      teacherList = teacherList.filter(
        (item) =>
          (item.TEACHER_NAME || "").toLowerCase().includes(kw) ||
          (item.TEACHER_SPECIALTY || "").toLowerCase().includes(kw),
      );
    }
    teacherList = teacherList.slice(0, 10);
    teacherList = await Promise.all(
      teacherList.map(async (item) => ({
        _id: item._id,
        type: "teacher",
        title: item.TEACHER_NAME,
        desc: item.TEACHER_SPECIALTY || "",
        pic: await this._fmtMediaUrl(item.TEACHER_AVATAR),
      })),
    );

    return { meetList, newsList, teacherList };
  }
}

module.exports = HomeService;
