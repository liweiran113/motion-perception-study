/* ===========================================================
   config.js —— 站点公开配置（可公开部署，不要写任何密钥）
   -----------------------------------------------------------
   mode    = "production" → 正式部署：页面不含预览、导入视频、调试入口
   backend = "supabase"   → 评分写入 Supabase；缺任何一项则前端直接报错
                            （不会退回本地，避免数据白采）
   studyId 在正式素材到位、清空 pilot 数据后再升级为 trajpg-subjective-v1.0
   =========================================================== */
window.TRAJPG_CONFIG = {
  mode: "production",
  backend: "supabase",
  studyId: "trajpg-subjective-v1.0-draft",
  webVersion: "pilot-1.1.4",

  supabase: {
    url: "https://fbvtbbptvcynvesnoqxm.supabase.co",   // 项目地址（不要带 /rest/v1/）
    anonKey: "sb_publishable_6jZd_TSWroLMKRbGEV6oAg_HbImPwVm"  // publishable key（公开密钥，可进仓库）
  }
};
