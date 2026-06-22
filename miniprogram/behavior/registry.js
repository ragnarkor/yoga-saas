/**
 * behavior 统一注册：静态 require，供 create_page 与零散页面引用
 */
module.exports = {
  default_index_bh: require("./default_index_bh.js"),
  about_index_bh: require("./about_index_bh.js"),
  about_contact_bh: require("./about_contact_bh.js"),
  calendar_index_bh: require("./calendar_index_bh.js"),
  meet_index_bh: require("./meet_index_bh.js"),
  meet_detail_bh: require("./meet_detail_bh.js"),
  meet_self_bh: require("./meet_self_bh.js"),
  my_index_bh: require("./my_index_bh.js"),
  my_join_bh: require("./my_join_bh.js"),
  my_course_bh: require("./my_course_bh.js"),
  my_join_detail_bh: require("./my_join_detail_bh.js"),
  news_index_bh: require("./news_index_bh.js"),
  news_detail_bh: require("./news_detail_bh.js"),
  search_bh: require("./search_bh.js"),
  teacher_detail_bh: require("./teacher_detail_bh.js"),
  announcement_detail_bh: require("./announcement_detail_bh.js"),
  home_search_result_bh: require("./home_search_result_bh.js"),
  public_hint_bh: require("./public_hint_bh.js"),
};
