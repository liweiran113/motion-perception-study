/* ===========================================================
   config.js —— 站点公开配置（可以公开部署，不要写密钥）
   -----------------------------------------------------------
   backend = "preview"  → 官方前端自带的本地预览模式（数据存 localStorage）
   backend = "supabase" → 正式采集模式（数据写入 Supabase，anon key 可公开）
   =========================================================== */
window.TRAJPG_CONFIG = {
  backend: "supabase",                 // ← 接好后改成 "supabase"
  studyId: "trajpg-subjective-v1.0-draft",
  webVersion: "pilot-1.0.0",

  supabase: {
    url: "https://fbvtbbptvcynvesnoqxm.supabase.co",   // ← 项目地址（不要带 /rest/v1/）
    anonKey: "sb_publishable_6jZd_TSWroLMKRbGEV6oAg_HbImPwVm"  // ← publishable key（公开密钥，可进仓库）
  }
};
