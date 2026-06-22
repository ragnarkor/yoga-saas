const BaseModel = require("./base_model.js");

class PhotoModel extends BaseModel {}

PhotoModel.CL = "ax_photo";

PhotoModel.DB_STRUCTURE = {
  _pid: "string|true",
  PHOTO_ID: "string|true",
  PHOTO_TITLE: "string|false|comment=标题",
  PHOTO_DESC: "string|false|comment=描述",
  PHOTO_PIC: "string|true|comment=图片",
  PHOTO_LINK_TYPE: "string|true|default=none|comment=news/meet/none",
  PHOTO_LINK_ID: "string|false|comment=跳转目标ID",
  PHOTO_ORDER: "int|true|default=9999",
  PHOTO_STATUS: "int|true|default=1|comment=0/1",
  PHOTO_ADD_TIME: "int|true",
  PHOTO_EDIT_TIME: "int|true",
  PHOTO_ADD_IP: "string|false",
  PHOTO_EDIT_IP: "string|false",
};

PhotoModel.FIELD_PREFIX = "PHOTO_";

module.exports = PhotoModel;
