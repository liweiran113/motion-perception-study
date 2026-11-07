/* ===========================================================
   评价页逻辑
   - 题目顺序、方案左右位置随机（避免位置偏好）
   - 盲评：只显示"方案 1/2/3"
   - 记录每题耗时，便于事后筛掉乱点的答卷
   - 配置全部来自 data/eval-config.js
   =========================================================== */
(function () {
  "use strict";

  var cfg = window.EVAL_CONFIG;
  var app = document.getElementById("app");
  if (!cfg || !app) {
    app.innerHTML = '<div class="alert">配置未加载：请确认 data/eval-config.js 存在且未被改坏。</div>';
    return;
  }

  var DONE_KEY = "pg_done_" + cfg.surveyId;
  var REC_KEY = "pg_records";

  var state = {
    sessionId: uid(),
    startedAt: Date.now(),
    step: 0,
    steps: [],
    answers: {},
    attn: {},
    times: {},
    trialStart: 0,
    optionOrder: {},
    trialOrder: [],
    payload: null
  };

  /* ---------------- 工具 ---------------- */
  function uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function isPairwise() {
    return (cfg.mode || "pairwise") === "pairwise";
  }

  /* ---------------- 构建步骤序列 ---------------- */
  function buildSteps() {
    var trials = shuffle(cfg.trials || []);
    state.trialOrder = trials.map(function (t) { return t.id; });
    trials.forEach(function (t) {
      state.optionOrder[t.id] = shuffle((t.options || []).map(function (o) { return o.key; }));
    });

    var steps = [{ type: "consent" }];
    var every = Number(cfg.attentionEvery || 0);
    var attnList = cfg.attention || [];
    var attnUsed = 0;

    trials.forEach(function (t, i) {
      steps.push({ type: "trial", trial: t });
      if (every > 0 && attnList.length && (i + 1) % every === 0 && attnUsed < attnList.length) {
        steps.push({ type: "attention", item: attnList[attnUsed], slot: attnUsed });
        attnUsed++;
      }
    });

    steps.push({ type: "done" });
    state.steps = steps;
  }

  /* ---------------- 渲染：进度条 ---------------- */
  function meter() {
    var total = state.steps.length - 2; // 去掉 consent 与 done
    var cur = Math.min(Math.max(state.step - 1, 0), total);
    var pct = total > 0 ? Math.round((cur / total) * 100) : 0;
    return '<div class="meter">' +
      '<span class="num">' + (cur >= total ? "已完成" : "第 " + (cur + 1) + " / " + total + " 题") + '</span>' +
      '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="num">' + pct + '%</span>' +
      '</div>';
  }

  /* ---------------- 渲染：知情同意 ---------------- */
  function renderConsent() {
    var c = cfg.consent || {};
    var ps = (c.text || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    app.innerHTML =
      '<h1 class="eval-title">' + esc(cfg.title) + '</h1>' +
      '<p class="eval-desc">' + esc(cfg.desc || "") + '</p>' +
      '<div class="card">' +
        '<h3>知情同意</h3>' +
        '<p class="hint">请先阅读以下内容。' + (c.required ? "必须勾选后才能开始。" : "") + '</p>' +
        '<div class="consent-box">' + (ps || "<p>（未设置说明文本）</p>") + '</div>' +
        '<label class="agree"><input type="checkbox" id="agree">' +
          '<span>我已阅读并理解上述内容，自愿参与本次评价。</span></label>' +
        '<div class="navrow">' +
          '<span class="note">共 ' + (cfg.trials || []).length + ' 组材料，约 5 分钟。</span>' +
          '<span class="spacer"></span>' +
          '<button class="btn primary" id="next" disabled>开始 →</button>' +
        '</div>' +
      '</div>';

    var box = document.getElementById("agree");
    var btn = document.getElementById("next");
    box.addEventListener("change", function () { btn.disabled = !box.checked; });
    btn.addEventListener("click", function () {
      state.step++;
      render();
    });
  }

  /* ---------------- 渲染：一组的视频 + 问题 ---------------- */
  function renderTrial(step) {
    var t = step.trial;
    var keys = state.optionOrder[t.id];
    var n = keys.length;
    var cols = n <= 2 ? 2 : (n === 3 ? 3 : 4);
    var optByKey = {};
    (t.options || []).forEach(function (o) { optByKey[o.key] = o; });

    var clips = keys.map(function (k, i) {
      var o = optByKey[k] || {};
      var label = "方案 " + (i + 1) + (cfg.blind ? "" : " · " + (o.model || ""));
      var body;
      if (o.video) {
        body = '<video src="' + esc(o.video) + '" controls muted loop playsinline preload="metadata"></video>';
      } else {
        body = '<div class="ph"><div>▶</div><div>视频占位</div><div style="font-size:10.5px;opacity:.8">' + esc(o.video || (o.key + ".mp4")) + '</div></div>';
      }
      return '<div class="clip"><span class="lab">' + label + '</span>' + body + '</div>';
    }).join("");

    var audio = t.audio
      ? '<div class="audio-row"><span class="k">输入语音</span><audio controls preload="none" src="' + esc(t.audio) + '"></audio></div>'
      : '';

    if (!state.answers[t.id]) state.answers[t.id] = {};

    var questions = (cfg.dimensions || []).map(function (d, di) {
      if (isPairwise()) {
        var opts = keys.map(function (k, i) {
          return '<label class="opt" data-dim="' + d.id + '" data-val="' + esc(k) + '">' +
            '<input type="radio" name="d-' + d.id + '" value="' + esc(k) + '">方案 ' + (i + 1) + '</label>';
        }).join("");
        opts += '<label class="opt tie" data-dim="' + d.id + '" data-val="tie">' +
          '<input type="radio" name="d-' + d.id + '" value="tie">无偏好</label>';
        return '<div class="qblock">' +
          '<p class="qtitle">' + (di + 1) + '. ' + esc(d.label) + '</p>' +
          (d.hint ? '<p class="qhint">' + esc(d.hint) + '</p>' : '') +
          '<div class="opts" data-group="' + d.id + '">' + opts + '</div>' +
          '</div>';
      }
      // likert：每个方案在每个维度上单独打分
      var s = cfg.likertScale || { min: 1, max: 5 };
      var rows = keys.map(function (k, i) {
        var btns = "";
        for (var v = s.min; v <= s.max; v++) {
          btns += '<button type="button" class="s" data-dim="' + d.id + '" data-opt="' + esc(k) + '" data-val="' + v + '">' + v + '</button>';
        }
        return '<div style="margin-bottom:10px">' +
          '<div class="mini" style="margin-bottom:5px">方案 ' + (i + 1) + (cfg.blind ? "" : " · " + esc(optByKey[k].model || "")) + '</div>' +
          '<div class="scale" data-group="' + d.id + '" data-opt="' + esc(k) + '">' + btns + '</div>' +
          '</div>';
      }).join("");
      var legend = (s.labels && s.labels.length)
        ? '<div class="scale-legend"><span>' + esc(s.labels[0]) + '</span><span>' + esc(s.labels[s.labels.length - 1]) + '</span></div>'
        : "";
      return '<div class="qblock">' +
        '<p class="qtitle">' + (di + 1) + '. ' + esc(d.label) + '</p>' +
        (d.hint ? '<p class="qhint">' + esc(d.hint) + '</p>' : '') +
        rows + legend +
        '</div>';
    }).join("");

    app.innerHTML =
      meter() +
      '<div class="card">' +
        '<h3>' + esc(t.title || "第 " + (state.step) + " 组") + '</h3>' +
        '<p class="hint">请先完整观看下面的 ' + n + ' 段片段，再逐项作答。' +
          (cfg.blind ? " 片段不标注方法名。" : "") + '</p>' +
        audio +
        '<div class="clip-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + clips + '</div>' +
        questions +
        '<div class="navrow">' +
          '<span class="note" id="note"></span>' +
          '<span class="spacer"></span>' +
          '<button class="btn primary" id="next" disabled>下一题 →</button>' +
        '</div>' +
      '</div>';

    state.trialStart = Date.now();

    // 交互
    var card = app.querySelector(".card");
    card.addEventListener("click", function (e) {
      var el = e.target.closest(".opt, .scale .s");
      if (!el) return;
      var dim = el.getAttribute("data-dim");
      if (!state.answers[t.id][dim]) state.answers[t.id][dim] = {};

      if (el.classList.contains("opt")) {
        var group = el.parentNode;
        Array.prototype.forEach.call(group.children, function (c) { c.classList.remove("on"); });
        el.classList.add("on");
        state.answers[t.id][dim].choice = el.getAttribute("data-val");
      } else {
        var optKey = el.getAttribute("data-opt");
        var row = el.parentNode;
        Array.prototype.forEach.call(row.children, function (c) { c.classList.remove("on"); });
        el.classList.add("on");
        if (!state.answers[t.id][dim].scores) state.answers[t.id][dim].scores = {};
        state.answers[t.id][dim].scores[optKey] = Number(el.getAttribute("data-val"));
        // likert 模式下 answers 用 scores 承载
        state.answers[t.id][dim].choice = null;
      }
      validate(t);
    });

    document.getElementById("next").addEventListener("click", function () {
      state.times[t.id] = Date.now() - state.trialStart;
      state.step++;
      render();
    });

    validate(t);
  }

  /* ---------------- 校验 ---------------- */
  function missingCount(t) {
    var dims = cfg.dimensions || [];
    var miss = 0;
    var a = state.answers[t.id] || {};
    dims.forEach(function (d) {
      var rec = a[d.id];
      if (!rec) { miss++; return; }
      if (isPairwise()) {
        if (!rec.choice) miss++;
      } else {
        var n = (t.options || []).length;
        var got = rec.scores ? Object.keys(rec.scores).length : 0;
        if (got < n) miss++;
      }
    });
    return miss;
  }

  function validate(t) {
    var miss = missingCount(t);
    var btn = document.getElementById("next");
    var note = document.getElementById("note");
    if (!btn) return;
    if (cfg.requireAll === false) { btn.disabled = false; }
    else btn.disabled = miss > 0;
    if (note) note.textContent = miss > 0 ? ("还有 " + miss + " 项未作答") : "";
  }

  /* ---------------- 渲染：注意力检查 ---------------- */
  function renderAttention(step) {
    var it = step.item;
    var opts = (it.options || []).map(function (o) {
      return '<label class="opt" data-val="' + esc(o) + '"><input type="radio" name="attn">' +
        esc(o) + '</label>';
    }).join("");

    app.innerHTML =
      meter() +
      '<div class="card">' +
        '<h3>请确认</h3>' +
        '<p class="hint">这是一道检查题，用于确认你在认真观看。</p>' +
        '<div class="qblock" style="border-top:none;padding-top:0;margin-top:0">' +
          '<p class="qtitle">' + esc(it.question) + '</p>' +
          '<div class="opts" id="attnOpts">' + opts + '</div>' +
        '</div>' +
        '<div class="navrow">' +
          '<span class="note" id="note"></span><span class="spacer"></span>' +
          '<button class="btn primary" id="next" disabled>继续 →</button>' +
        '</div>' +
      '</div>';

    var chosen = null;
    document.getElementById("attnOpts").addEventListener("click", function (e) {
      var el = e.target.closest(".opt");
      if (!el) return;
      Array.prototype.forEach.call(this.children, function (c) { c.classList.remove("on"); });
      el.classList.add("on");
      chosen = el.getAttribute("data-val");
      state.attn[it.id] = chosen;
      document.getElementById("next").disabled = false;
    });

    document.getElementById("next").addEventListener("click", function () {
      state.step++;
      render();
    });
  }

  /* ---------------- 计分 ---------------- */
  function computeScores(t) {
    var a = state.answers[t.id] || {};
    var out = {};
    var ps = cfg.pairwiseScale || { chosen: 2, others: -1, tie: 0 };
    var keys = state.optionOrder[t.id] || [];
    (cfg.dimensions || []).forEach(function (d) {
      var rec = a[d.id] || {};
      if (isPairwise()) {
        var scores = {};
        if (!rec.choice) { out[d.id] = null; return; }
        if (rec.choice === "tie") {
          keys.forEach(function (k) { scores[k] = ps.tie; });
        } else {
          keys.forEach(function (k) { scores[k] = (k === rec.choice) ? ps.chosen : ps.others; });
        }
        out[d.id] = { chosen: rec.choice, scores: scores };
      } else {
        out[d.id] = { scores: rec.scores || {} };
      }
    });
    return out;
  }

  /* ---------------- 提交 ---------------- */
  function buildPayload() {
    var trials = state.trialOrder.map(function (id) {
      var t = (cfg.trials || []).filter(function (x) { return x.id === id; })[0] || {};
      return {
        trialId: id,
        title: t.title || "",
        shownOptionOrder: state.optionOrder[id],
        answers: state.answers[id] || {},
        scores: computeScores(t),
        ms: state.times[id] || null
      };
    });

    var attn = Object.keys(state.attn).map(function (id) {
      var item = (cfg.attention || []).filter(function (x) { return x.id === id; })[0] || {};
      return { id: id, answer: state.attn[id], expected: item.answer || null, correct: item.answer ? state.attn[id] === item.answer : null };
    });

    return {
      surveyId: cfg.surveyId,
      sessionId: state.sessionId,
      mode: cfg.mode,
      blind: !!cfg.blind,
      startedAt: new Date(state.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - state.startedAt,
      userAgent: navigator.userAgent,
      viewport: window.innerWidth + "x" + window.innerHeight,
      lang: navigator.language,
      trials: trials,
      attention: attn,
      configSnapshot: {
        dimensions: cfg.dimensions,
        pairwiseScale: cfg.pairwiseScale,
        likertScale: cfg.likertScale,
        trialCount: (cfg.trials || []).length
      }
    };
  }

  function saveLocal(payload) {
    try {
      var arr = JSON.parse(localStorage.getItem(REC_KEY) || "[]");
      arr.push(payload);
      localStorage.setItem(REC_KEY, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  }

  function submit(payload) {
    var ep = (cfg.submit && cfg.submit.endpoint || "").trim();
    if (!ep) { saveLocal(payload); return Promise.resolve({ offline: true }); }
    return fetch(ep, {
      method: (cfg.submit.method || "POST"),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return { ok: true };
    }).catch(function (e) {
      saveLocal(payload);
      return { ok: false, error: e.message };
    });
  }

  function download(payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eval-" + payload.surveyId + "-" + payload.sessionId + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  /* ---------------- 渲染：完成 ---------------- */
  function renderDone(result) {
    var p = state.payload;
    var total = p.trials.length;
    var answered = p.trials.filter(function (t) { return Object.keys(t.answers || {}).length > 0; }).length;
    var avgMs = 0;
    var n = 0;
    p.trials.forEach(function (t) { if (t.ms) { avgMs += t.ms; n++; } });
    avgMs = n ? Math.round(avgMs / n / 1000) : 0;

    var status = "";
    if (result.offline) {
      status = '<div class="alert info">当前为演示模式：数据只保存在本机浏览器，没有上传到任何服务器。' +
        '接上 Supabase 或第三方表单后，这里会直接写入数据库。</div>';
    } else if (result.ok) {
      status = '<div class="alert info">提交成功，感谢参与。</div>';
    } else {
      status = '<div class="alert">提交失败（' + esc(result.error || "网络异常") + '）。数据已暂存在本机，请下载备份或稍后重试。</div>';
    }

    app.innerHTML =
      '<div style="text-align:center;padding:20px 0 8px">' +
        '<div class="done-icon">✓</div>' +
        '<h1 class="eval-title">已完成，谢谢！</h1>' +
        '<p class="eval-desc">你的每一份判断都会体现在论文的用户研究部分。</p>' +
      '</div>' +
      '<div class="card soft">' +
        status +
        '<dl class="kv" style="margin-top:16px">' +
          '<dt>问卷编号</dt><dd>' + esc(p.surveyId) + '</dd>' +
          '<dt>答卷 ID</dt><dd>' + esc(p.sessionId) + '</dd>' +
          '<dt>完成组数</dt><dd>' + answered + ' / ' + total + '</dd>' +
          '<dt>平均每组用时</dt><dd>' + avgMs + ' 秒</dd>' +
          '<dt>总用时</dt><dd>' + Math.round(p.durationMs / 1000) + ' 秒</dd>' +
        '</dl>' +
        '<div class="navrow">' +
          '<button class="btn" id="dl">下载我的答卷（JSON）</button>' +
          '<span class="spacer"></span>' +
          '<a class="btn" href="./index.html">返回主页</a>' +
        '</div>' +
      '</div>';

    document.getElementById("dl").addEventListener("click", function () { download(p); });
  }

  /* ---------------- 已完成拦截 ---------------- */
  function renderAlreadyDone() {
    var prev = null;
    try { prev = JSON.parse(localStorage.getItem(DONE_KEY) || "null"); } catch (e) {}
    app.innerHTML =
      '<h1 class="eval-title">你已经提交过了</h1>' +
      '<p class="eval-desc">为避免同一人重复作答影响数据，本机记录显示这份问卷已完成。</p>' +
      '<div class="card">' +
        '<dl class="kv">' +
          '<dt>提交时间</dt><dd>' + esc(prev && prev.at || "未知") + '</dd>' +
          '<dt>答卷 ID</dt><dd>' + esc(prev && prev.sessionId || "未知") + '</dd>' +
        '</dl>' +
        '<div class="navrow">' +
          '<span class="note">如需重新体验（调试时用），会覆盖本机记录。</span><span class="spacer"></span>' +
          '<button class="btn" id="reset">重新开始</button>' +
          '<a class="btn primary" href="./index.html">返回主页</a>' +
        '</div>' +
      '</div>';
    document.getElementById("reset").addEventListener("click", function () {
      localStorage.removeItem(DONE_KEY);
      state.step = 0;
      state.answers = {};
      state.attn = {};
      state.times = {};
      state.startedAt = Date.now();
      state.sessionId = uid();
      buildSteps();
      render();
    });
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    var step = state.steps[state.step];
    if (!step) return;
    if (step.type === "consent") return renderConsent();
    if (step.type === "trial") return renderTrial(step);
    if (step.type === "attention") return renderAttention(step);
    if (step.type === "done") {
      state.payload = buildPayload();
      submit(state.payload).then(function (res) {
        try {
          localStorage.setItem(DONE_KEY, JSON.stringify({
            at: new Date().toISOString(),
            sessionId: state.payload.sessionId
          }));
        } catch (e) {}
        renderDone(res);
      });
    }
  }

  /* ---------------- 启动 ---------------- */
  if (localStorage.getItem(DONE_KEY) && location.hash !== "#trial") {
    renderAlreadyDone();
  } else {
    buildSteps();
    // 预览用：eval.html#trial 直接跳到第一题，方便调样式
    if (location.hash === "#trial") state.step = 1;
    render();
  }

  window.__evalState = state; // 调试用
})();
