/**
 * 皮肤配置基类：各租户 skin 仅 override 差异字段
 */
module.exports = {
  IMG_ROOT: "/pages/default/skin/images",
  IMG_DEFAULT_INDEX_BG: "/pages/default/skin/images/default_index_bg.jpg",
  IMG_UPIMG: "/pages/default/skin/images/upimg.jpg",
  IMG_DEFAULT_COVER: "/images/default_cover_pic.gif",
  NAV_COLOR: "#ffffff",
  NAV_BG: "#5B8A72",

  MEET_NAME: "约课",
  MENU_ITEM: ["首页", "约课", "课程", "我的"],

  NEWS_CATE: "1=本店动态|rightpic,2=瑜伽常识|leftpic",
  MEET_TYPE:
    "1=特色课程|leftbig3,2=精品课|leftbig2,3=私教课|leftbig3,4=私教定制|leftbig2,5=核心床|leftbig3",

  DEFAULT_FORMS: [
    {
      type: "line",
      title: "姓名",
      desc: "请填写您的姓名",
      must: true,
      len: 50,
      onlySet: { mode: "all", cnt: -1 },
      selectOptions: ["", ""],
      mobileTruth: true,
      checkBoxLimit: 2,
    },
    {
      type: "line",
      title: "手机",
      desc: "选填，便于馆里联系您",
      must: false,
      len: 50,
      onlySet: { mode: "all", cnt: -1 },
      selectOptions: ["", ""],
      mobileTruth: true,
      checkBoxLimit: 2,
    },
  ],
};
