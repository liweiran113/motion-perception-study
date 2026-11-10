/* ===========================================================
   api.js —— 后端适配层
   -----------------------------------------------------------
   把官方前端 README 里约定的 /api/start、/api/session、/api/submit
   映射到 Supabase 的三个 Postgres 函数（RPC）：

     start   → rpc/start_session
     session → rpc/get_session
     submit  → rpc/submit_scores

   前端只拿到：participant_id、匿名 media id、视频地址。
   真实方法名只存在数据库里，绝不会下发到浏览器。
   =========================================================== */
(function () {
  var C = window.TRAJPG_CONFIG || {};
  var S = C.supabase || {};
  var ON = C.backend === "supabase" && !!S.url && !!S.anonKey;

  function base() {
    /* 容错：即使把 .../rest/v1/ 整段粘进来，也能拼出正确地址 */
    return String(S.url).replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  }

  function endpoint(fn) {
    return base() + "/rest/v1/rpc/" + fn;
  }

  async function rpc(fn, body) {
    var res = await fetch(endpoint(fn), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: S.anonKey,
        Authorization: "Bearer " + S.anonKey
      },
      body: JSON.stringify(body || {})
    });
    var text = await res.text();
    if (!res.ok) {
      var msg = text;
      try {
        var j = JSON.parse(text);
        msg = j.message || j.hint || j.details || text;
      } catch (e) {}
      throw new Error(msg || "HTTP " + res.status);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  window.API = {
    config: C,
    enabled: function () {
      return ON;
    },

    /* 创建会话：服务端分配 serial、定组、冻结 1 练习 + 8 正式 + 2 检查 */
    start: function (o) {
      return rpc("start_session", {
        p_study_id: C.studyId,
        p_expertise: o.expertise,
        p_age_confirmed: !!o.age,
        p_consent_confirmed: !!o.consent,
        p_audio_confirmed: !!o.audio,
        p_web_version: C.webVersion,
        p_is_test: !!o.isTest
      });
    },

    /* 恢复会话：刷新后用，取回同一套分配，绝不重新随机 */
    getSession: function (participantId) {
      return rpc("get_session", { p_participant_id: participantId });
    },

    /* 提交评分：final=false 增量保存，final=true 定稿并计算有效性 */
    submit: function (participantId, ratings, isFinal) {
      return rpc("submit_scores", {
        p_participant_id: participantId,
        p_ratings: ratings,
        p_final: isFinal !== false
      });
    }
  };
})();
