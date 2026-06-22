/**
 * Notes: 首页内容后台管理
 */

const BaseAdminService = require("./base_admin_service.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const util = require("../../../framework/utils/util.js");
const BannerModel = require("../../model/banner_model.js");
const AnnouncementModel = require("../../model/announcement_model.js");
const TeacherModel = require("../../model/teacher_model.js");
const PhotoModel = require("../../model/photo_model.js");

class AdminHomeService extends BaseAdminService {
  async getBannerList() {
    return await BannerModel.getAll(
      { BANNER_STATUS: 1 },
      "*",
      { BANNER_ORDER: "asc", BANNER_ADD_TIME: "desc" },
      100,
    );
  }

  async insertBanner(data) {
    data.BANNER_STATUS = 1;
    return await BannerModel.insert(data);
  }

  async editBanner(id, data) {
    await BannerModel.edit({ _id: id }, data);
  }

  async delBanner(id) {
    let item = await BannerModel.getOne({ _id: id }, "BANNER_PIC,BANNER_VIDEO");
    if (!item) return;
    let files = [];
    if (item.BANNER_PIC) files.push(item.BANNER_PIC);
    if (item.BANNER_VIDEO) files.push(item.BANNER_VIDEO);
    if (files.length) await cloudUtil.deleteFiles(files);
    await BannerModel.del({ _id: id });
  }

  async getAnnounceList() {
    return await AnnouncementModel.getAll(
      {},
      "*",
      { ANNOUNCE_ORDER: "asc", ANNOUNCE_ADD_TIME: "desc" },
      100,
    );
  }

  async insertAnnounce(data) {
    data.ANNOUNCE_STATUS = 1;
    data.ANNOUNCE_CONTENT = data.ANNOUNCE_CONTENT || [];
    return await AnnouncementModel.insert(data);
  }

  async editAnnounce(id, data) {
    await AnnouncementModel.edit({ _id: id }, data);
  }

  async delAnnounce(id) {
    await AnnouncementModel.del({ _id: id });
  }

  async getTeacherList() {
    return await TeacherModel.getAll(
      {},
      "*",
      { TEACHER_ORDER: "asc", TEACHER_ADD_TIME: "desc" },
      100,
    );
  }

  async insertTeacher(data) {
    data.TEACHER_STATUS = 1;
    data.TEACHER_PIC = data.TEACHER_PIC || [];
    data.TEACHER_HOME = util.isDefined(data.TEACHER_HOME) ? data.TEACHER_HOME : 1;
    return await TeacherModel.insert(data);
  }

  async editTeacher(id, data) {
    await TeacherModel.edit({ _id: id }, data);
  }

  async delTeacher(id) {
    let item = await TeacherModel.getOne({ _id: id }, "TEACHER_AVATAR,TEACHER_PIC");
    if (!item) return;
    let files = [];
    if (item.TEACHER_AVATAR) files.push(item.TEACHER_AVATAR);
    if (item.TEACHER_PIC && item.TEACHER_PIC.length) files = files.concat(item.TEACHER_PIC);
    if (files.length) await cloudUtil.deleteFiles(files);
    await TeacherModel.del({ _id: id });
  }

  async getPhotoList() {
    return await PhotoModel.getAll(
      {},
      "*",
      { PHOTO_ORDER: "asc", PHOTO_ADD_TIME: "desc" },
      100,
    );
  }

  async insertPhoto(data) {
    data.PHOTO_STATUS = 1;
    return await PhotoModel.insert(data);
  }

  async editPhoto(id, data) {
    await PhotoModel.edit({ _id: id }, data);
  }

  async delPhoto(id) {
    let item = await PhotoModel.getOne({ _id: id }, "PHOTO_PIC");
    if (!item) return;
    if (item.PHOTO_PIC) await cloudUtil.deleteFiles([item.PHOTO_PIC]);
    await PhotoModel.del({ _id: id });
  }
}

module.exports = AdminHomeService;
