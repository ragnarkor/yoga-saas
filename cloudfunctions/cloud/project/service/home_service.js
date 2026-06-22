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

    let [rawBanners, rawAnnounces, rawTeachers, rawPhotos] = await Promise.all([
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
        TeacherModel,
        { TEACHER_STATUS: 1, TEACHER_HOME: 1 },
        "TEACHER_NAME,TEACHER_AVATAR,TEACHER_PIC,TEACHER_SPECIALTY,TEACHER_DESC",
        { TEACHER_ORDER: "asc", TEACHER_ADD_TIME: "desc" },
        20,
      ),
      this._safeGetAll(
        PhotoModel,
        { PHOTO_STATUS: 1 },
        "PHOTO_TITLE,PHOTO_DESC,PHOTO_PIC,PHOTO_LINK_TYPE,PHOTO_LINK_ID",
        { PHOTO_ORDER: "asc", PHOTO_ADD_TIME: "desc" },
        30,
      ),
    ]);

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
      linkType: item.PHOTO_LINK_TYPE || "none",
      linkId: item.PHOTO_LINK_ID || "",
    }));

    return { phone, banners, announcements, teachers, photos };
  }

  async getTeacherDetail(id) {
    let teacher = await TeacherModel.getOne(
      { _id: id, TEACHER_STATUS: 1 },
      "TEACHER_NAME,TEACHER_AVATAR,TEACHER_PIC,TEACHER_SPECIALTY,TEACHER_DESC",
    );
    if (!teacher) return null;

    return {
      _id: teacher._id,
      name: teacher.TEACHER_NAME,
      avatar: await this._fmtMediaUrl(teacher.TEACHER_AVATAR),
      specialty: teacher.TEACHER_SPECIALTY || "",
      desc: teacher.TEACHER_DESC || "",
      pics: await this._fmtMediaUrls(teacher.TEACHER_PIC || []),
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

    let teacherWhere = {
      TEACHER_STATUS: 1,
      TEACHER_NAME: { $regex: ".*" + keyword, $options: "i" },
    };
    let teacherList = await this._safeGetAll(
      TeacherModel,
      teacherWhere,
      "TEACHER_NAME,TEACHER_AVATAR,TEACHER_SPECIALTY",
      { TEACHER_ORDER: "asc" },
      10,
    );
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
