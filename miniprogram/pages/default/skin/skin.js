module.exports = {
  PID: "default", // 标准模板

  NAV_COLOR: "#ffffff",
  NAV_BG: "#5B8A72",

  MEET_NAME: "约课",

  MENU_ITEM: ["首页", "约课", "课程", "我的"], // 四入口导航

  NEWS_CATE: "1=本店动态|rightpic,2=瑜伽常识|leftpic",
  MEET_TYPE:
    "1=特色课程|leftbig3,2=精品课|leftbig2,3=私教课|leftbig3,4=私教定制|leftbig2,5=核心床|leftbig3",
  // [AI_END LINES=14 TIMESTAMP=2025-01-24 12:00:00]

  DEFAULT_FORMS: [
    {
      type: "line",
      title: "姓名",
      desc: "请填写您的姓名",
      must: true,
      len: 50,
      onlySet: {
        mode: "all",
        cnt: -1,
      },
      selectOptions: ["", ""],
      mobileTruth: true,
      checkBoxLimit: 2,
    },
    {
      type: "line",
      title: "手机",
      desc: "请填写您的手机号码",
      must: true,
      len: 50,
      onlySet: {
        mode: "all",
        cnt: -1,
      },
      selectOptions: ["", ""],
      mobileTruth: true,
      checkBoxLimit: 2,
    },
  ],
};
