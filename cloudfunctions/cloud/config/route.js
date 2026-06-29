/**
 * Notes: 路由配置文件
 * User: CC
 * Date: 2020-10-14 07:00:00
 */

module.exports = {
  // 租户（多馆）相关
  "tenant/list": "tenant_controller@getTenantList",
  "tenant/detail": "tenant_controller@getTenantDetail",

  "home/setup_all": "home_controller@getSetupAll", //获取全局配置(所有)
  "home/index": "home_controller@getHomeIndex",
  "home/search": "home_controller@searchHome",
  "home/teacher_detail": "home_controller@getTeacherDetail",
  "home/teacher_home": "home_controller@getTeacherHome",
  "home/announce_detail": "home_controller@getAnnounceDetail",

  "passport/phone": "passport_controller@getPhone",
  "passport/my_detail": "passport_controller@getMyDetail",
  "passport/my_tenants": "passport_controller@getMyTenants",
  "passport/sync_profile": "passport_controller@syncProfile",
  "passport/edit_base": "passport_controller@editBase",
  "passport/join_tenant": "passport_controller@joinTenant",
  "passport/ensure_member": "passport_controller@ensureMember",

  "news/list": "news_controller@getNewsList",
  "news/home_list": "news_controller@getHomeNewsList",
  "news/view": "news_controller@viewNews",

  "meet/list": "meet_controller@getMeetList",
  "meet/list_by_day": "meet_controller@getMeetListByDay",
  "meet/list_by_week": "meet_controller@getMeetListByWeek",
  "meet/list_has_day": "meet_controller@getHasDaysFromDay",
  "meet/view": "meet_controller@viewMeet",
  "meet/join_roster": "meet_controller@getJoinRoster",
  "meet/join_card_options": "meet_controller@getJoinCardOptions",
  "meet/detail_for_join": "meet_controller@detailForJoin",
  "meet/before_join": "meet_controller@beforeJoin",
  "meet/join": "meet_controller@join",

  "private/meta": "private_controller@getMeta",
  "private/available_slots": "private_controller@getAvailableSlots",
  "private/book": "private_controller@bookSession",

  "my/my_join_list": "meet_controller@getMyJoinList",
  "my/my_join_cancel": "meet_controller@cancelMyJoin",
  "my/my_join_detail": "meet_controller@getMyJoinDetail",
  "my/my_join_someday": "meet_controller@getMyJoinSomeday",
  "my/my_join_checkin": "meet_controller@userSelfCheckin",
  "my/my_card_list": "card_controller@getMyCardList",
  "my/my_card_summary": "card_controller@getMyCardSummary",
  "my/my_card_detail": "card_controller@getMyCardDetail",

  "test/test": "test/test_controller@test",
  "test/seed": "test/test_controller@seed",
  "test/meet_test_join": "test/test_meet_controller@testJoin",

  //***########### ADMIN ################## */
  "admin/login": "admin/admin_home_controller@adminLogin",
  "admin/home": "admin/admin_home_controller@adminHome",
  "admin/wx_session": "admin/admin_home_controller@wxSession",
  "admin/wx_bind": "admin/admin_home_controller@wxBind",
  "admin/wx_tenant_list": "admin/admin_home_controller@wxTenantList",
  "admin/bind_code_gen": "admin/admin_home_controller@genBindCode#noDemo",
  "admin/wx_unbind": "admin/admin_home_controller@wxUnbind#noDemo",
  "admin/bind_admin_list": "admin/admin_home_controller@listBindableAdmins",
  "admin/member_invite_qr": "admin/admin_home_controller@genMemberInviteQr",
  "admin/tenant_store": "admin/admin_tenant_controller@getStore",
  "admin/tenant_store_save":
    "admin/admin_tenant_controller@saveMeetCategories#noDemo",
  "admin/member_stats": "admin/admin_tenant_controller@getMemberStats",
  "admin/platform_overview":
    "admin/admin_tenant_controller@getPlatformOverview",
  "admin/platform_staff_list": "admin/admin_home_controller@listPlatformStaff",
  "admin/tenant_insert": "admin/admin_tenant_controller@insertTenant#noDemo",
  "admin/mgr_list": "admin/admin_mgr_controller@getAdminList",
  "admin/mgr_insert": "admin/admin_mgr_controller@insertAdmin#noDemo",
  "admin/staff_insert": "admin/admin_mgr_controller@insertStaff#noDemo",
  "admin/mgr_del": "admin/admin_mgr_controller@deleteAdmin#noDemo",

  "admin/card_tpl_list": "admin/admin_card_controller@getCardTplList",
  "admin/card_tpl_detail": "admin/admin_card_controller@getCardTplDetail",
  "admin/card_tpl_save": "admin/admin_card_controller@saveCardTpl#noDemo",
  "admin/card_tpl_del": "admin/admin_card_controller@delCardTpl#noDemo",
  "admin/coach_member_list": "admin/admin_card_controller@getCoachMemberList",
  "admin/month_new_card_members":
    "admin/admin_card_controller@getMonthNewCardMembers",
  "admin/user_card_issue": "admin/admin_card_controller@issueUserCard#noDemo",
  "admin/user_card_list": "admin/admin_card_controller@getUserCardList",
  "admin/user_join_card_options":
    "admin/admin_card_controller@getUserJoinCardOptions",
  "admin/user_card_detail": "admin/admin_card_controller@getUserCardDetail",
  "admin/user_card_adjust": "admin/admin_card_controller@adjustUserCard#noDemo",
  "admin/user_card_del": "admin/admin_card_controller@delUserCard#noDemo",
  "admin/private_meta": "admin/admin_private_controller@getMeta",
  "admin/private_list": "admin/admin_private_controller@listSessions",
  "admin/private_check": "admin/admin_private_controller@checkSlot",
  "admin/private_book": "admin/admin_private_controller@bookSession#noDemo",
  "admin/stats_card_analysis": "admin/admin_stats_controller@getCardAnalysis",
  "admin/stats_class": "admin/admin_stats_controller@getClassStats",
  "admin/stats_rank": "admin/admin_stats_controller@getBookingRank",
  "admin/stats_fund": "admin/admin_stats_controller@getFundDetails",
  "admin/stats_consume": "admin/admin_stats_controller@getConsumeStats",
  "admin/income_data_get": "admin/admin_export_controller@incomeDataGet",
  "admin/income_data_export": "admin/admin_export_controller@incomeDataExport",
  "admin/income_data_del": "admin/admin_export_controller@incomeDataDel#noDemo",
  "admin/stats_join_query": "admin/admin_stats_controller@getJoinQuery",
  "admin/stats_schedule_query": "admin/admin_stats_controller@getScheduleQuery",
  "admin/clear_cache": "admin/admin_home_controller@clearCache#noDemo",

  "admin/setup_about": "admin/admin_setup_controller@setupAbout#noDemo",
  "admin/setup_contact": "admin/admin_setup_controller@setupContact#noDemo",
  "admin/setup_qr": "admin/admin_setup_controller@genMiniQr",
  // [AI_START TIMESTAMP=2025-01-25 12:00:00]
  "admin/setup_feature": "admin/admin_setup_controller@setupFeature#noDemo",
  "admin/setup_feature_get": "admin/admin_setup_controller@getFeature",
  // [AI_END LINES=2 TIMESTAMP=2025-01-25 12:00:00]

  "admin/home_banner_list": "admin/admin_home_controller@getBannerList",
  "admin/home_banner_insert": "admin/admin_home_controller@insertBanner#noDemo",
  "admin/home_banner_edit": "admin/admin_home_controller@editBanner#noDemo",
  "admin/home_banner_del": "admin/admin_home_controller@delBanner#noDemo",
  "admin/home_announce_list": "admin/admin_home_controller@getAnnounceList",
  "admin/home_announce_insert":
    "admin/admin_home_controller@insertAnnounce#noDemo",
  "admin/home_announce_edit": "admin/admin_home_controller@editAnnounce#noDemo",
  "admin/home_announce_del": "admin/admin_home_controller@delAnnounce#noDemo",
  "admin/home_teacher_list": "admin/admin_home_controller@getTeacherList",
  "admin/home_teacher_insert":
    "admin/admin_home_controller@insertTeacher#noDemo",
  "admin/home_teacher_del": "admin/admin_home_controller@delTeacher#noDemo",
  "admin/my_teacher_profile": "admin/admin_home_controller@getMyTeacherProfile",
  "admin/my_teacher_profile_save":
    "admin/admin_home_controller@saveMyTeacherProfile#noDemo",
  "admin/home_photo_list": "admin/admin_home_controller@getPhotoList",
  "admin/home_photo_insert": "admin/admin_home_controller@insertPhoto#noDemo",
  "admin/home_photo_edit": "admin/admin_home_controller@editPhoto#noDemo",
  "admin/home_photo_del": "admin/admin_home_controller@delPhoto#noDemo",

  "admin/news_list": "admin/admin_news_controller@getNewsList",
  "admin/news_insert": "admin/admin_news_controller@insertNews#noDemo",
  "admin/news_detail": "admin/admin_news_controller@getNewsDetail",
  "admin/news_edit": "admin/admin_news_controller@editNews#noDemo",
  "admin/news_update_pic": "admin/admin_news_controller@updateNewsPic#noDemo",
  "admin/news_update_content":
    "admin/admin_news_controller@updateNewsContent#noDemo",
  "admin/news_del": "admin/admin_news_controller@delNews#noDemo",
  "admin/news_sort": "admin/admin_news_controller@sortNews#noDemo",
  "admin/news_status": "admin/admin_news_controller@statusNews#noDemo",

  "admin/meet_list": "admin/admin_meet_controller@getMeetList",
  "admin/schedule_week": "admin/admin_meet_controller@getScheduleWeek",
  "admin/schedule_slot_remove":
    "admin/admin_meet_controller@removeScheduleSlot#noDemo",
  "admin/meet_join_list": "admin/admin_meet_controller@getJoinList",
  "admin/join_status": "admin/admin_meet_controller@statusJoin#noDemo",
  "admin/join_del": "admin/admin_meet_controller@delJoin#noDemo",
  "admin/meet_insert": "admin/admin_meet_controller@insertMeet#noDemo",
  "admin/meet_detail": "admin/admin_meet_controller@getMeetDetail",
  "admin/meet_edit": "admin/admin_meet_controller@editMeet#noDemo",
  "admin/meet_del": "admin/admin_meet_controller@delMeet#noDemo",
  "admin/meet_update_content":
    "admin/admin_meet_controller@updateMeetContent#noDemo",
  "admin/meet_update_style":
    "admin/admin_meet_controller@updateMeetStyleSet#noDemo",
  "admin/meet_sort": "admin/admin_meet_controller@sortMeet#noDemo",
  "admin/meet_status": "admin/admin_meet_controller@statusMeet#noDemo",
  "admin/meet_cancel_time_join":
    "admin/admin_meet_controller@cancelJoinByTimeMark#noDemo",
  "admin/meet_restore_time_slot":
    "admin/admin_meet_controller@restoreScheduleSlot#noDemo",
  "admin/join_scan": "admin/admin_meet_controller@scanJoin#noDemo",
  "admin/join_checkin": "admin/admin_meet_controller@checkinJoin#noDemo",
  "admin/join_checkin_batch":
    "admin/admin_meet_controller@checkinJoinBatch#noDemo",
  "admin/group_book": "admin/admin_meet_controller@bookGroupJoin#noDemo",
  "admin/self_checkin_qr": "admin/admin_meet_controller@genSelfCheckinQr",
  "admin/meet_day_list": "admin/admin_meet_controller@getDayList",

  "admin/join_data_get": "admin/admin_export_controller@joinDataGet",
  "admin/join_data_export": "admin/admin_export_controller@joinDataExport",
  "admin/join_data_del": "admin/admin_export_controller@joinDataDel#noDemo",

  "admin/temp_insert": "admin/admin_meet_controller@insertTemp#noDemo",
  "admin/temp_list": "admin/admin_meet_controller@getTempList",
  "admin/temp_del": "admin/admin_meet_controller@delTemp#noDemo",
  "admin/temp_edit": "admin/admin_meet_controller@editTemp#noDemo",

  "admin/log_list": "admin/admin_mgr_controller@getLogList",

  "admin/user_list": "admin/admin_user_controller@getUserList",
  "admin/user_detail": "admin/admin_user_controller@getUserDetail",
  "admin/user_del": "admin/admin_user_controller@delUser#noDemo",

  "admin/user_data_get": "admin/admin_export_controller@userDataGet",
  "admin/user_data_export": "admin/admin_export_controller@userDataExport",
  "admin/user_data_del": "admin/admin_export_controller@userDataDel#noDemo",
};
