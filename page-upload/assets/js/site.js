/* ===========================================================
   展示页渲染器
   把 data/site-config.js 的内容拼成页面。
   改内容不需要动这里。
   =========================================================== */
(function () {
  "use strict";

  var C = window.SITE_CONFIG;
  var root = document.getElementById("page");

  if (!C) {
    root.innerHTML = '<div class="wrap" style="padding:60px 24px">' +
      '<h2 class="sec">缺少内容配置</h2>' +
      '<p>请确认 <code>data/site-config.js</code> 存在且没有被改坏。</p></div>';
    return;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function has(v) {
    return v !== undefined && v !== null && String(v).trim() !== "";
  }

  /* 主题色 */
  if (C.theme && C.theme.accent) {
    document.documentElement.style.setProperty("--link", C.theme.accent);
    document.documentElement.style.setProperty("--link-dark", C.theme.accent);
  }

  /* 标题 */
  if (C.meta && C.meta.title) document.title = C.meta.title;
  if (C.meta && C.meta.description) {
    var md = document.querySelector('meta[name="description"]');
    if (!md) {
      md = document.createElement("meta");
      md.setAttribute("name", "description");
      document.head.appendChild(md);
    }
    md.setAttribute("content", C.meta.description);
  }

  var out = [];

  /* ---------- 提示条 ---------- */
  if (C.demoBar && C.demoBar.show) {
    out.push(
      '<div class="demo-bar" id="demoBar"><div class="wrap">' +
        (C.demoBar.strong ? '<strong>' + esc(C.demoBar.strong) + '</strong>' : '') +
        '<span>' + esc(C.demoBar.text || '') + '</span>' +
        '<button onclick="document.getElementById(\'demoBar\').remove()">知道了</button>' +
      '</div></div>'
    );
  }

  /* ---------- 头部 ---------- */
  var H = C.hero || {};
  var authors = (H.authors || []).map(function (a) {
    var name = has(a.url)
      ? '<a href="' + esc(a.url) + '">' + esc(a.name) + '</a>'
      : esc(a.name);
    return '<span>' + name + (has(a.affil) ? '<sup>' + esc(a.affil) + '</sup>' : '') + '</span>';
  }).join(", ");

  var affils = (H.affiliations || []).map(function (af) {
    return '<sup>' + esc(af.id) + '</sup> ' + esc(af.text);
  }).join(" &nbsp;&nbsp; ");

  var links = (H.links || []).map(function (l) {
    return '<a class="btn' + (l.primary ? " primary" : "") + '" href="' + esc(l.href || "#") + '">' +
      (has(l.icon) ? '<span class="ico">' + esc(l.icon) + '</span>' : '') +
      esc(l.label) + '</a>';
  }).join("");

  out.push(
    '<header class="hero"><div class="wrap">' +
      (has(H.eyebrow) ? '<span class="eyebrow">' + esc(H.eyebrow) + '</span>' : '') +
      '<h1 class="title">' + esc(H.title || "") + '</h1>' +
      (has(H.subtitle) ? '<p class="subtitle">' + esc(H.subtitle) + '</p>' : '') +
      (authors ? '<p class="authors">' + authors + '</p>' : '') +
      (affils ? '<p class="affil">' + affils + '</p>' : '') +
      (has(H.venue) ? '<p class="venue">' + esc(H.venue) + '</p>' : '') +
      (has(H.corresponding) ? '<p class="corresp">' + esc(H.corresponding) + '</p>' : '') +
      (links ? '<div class="links">' + links + '</div>' : '') +
    '</div></header>'
  );

  /* ---------- 主视觉 ---------- */
  var T = C.teaser || {};
  if (has(T.src) || has(T.caption)) {
    var teaserMedia = has(T.src)
      ? '<video class="media hero-teaser" src="' + esc(T.src) + '"' +
        (has(T.poster) ? ' poster="' + esc(T.poster) + '"' : '') +
        ' controls muted loop playsinline></video>'
      : '<div class="media hero-teaser"><div class="stack"><div class="play">▶</div>' +
        '<div>主视觉视频（Teaser）</div><code>static/videos/teaser.mp4</code></div></div>';
    out.push('<section><div class="wrap">' + teaserMedia +
      (has(T.caption) ? '<p class="cap">' + esc(T.caption) + '</p>' : '') +
      '</div></section>');
  }

  /* ---------- 摘要 ---------- */
  var A = C.abstract || {};
  if ((A.paragraphs || []).length) {
    out.push(
      '<section id="abstract"><div class="wrap">' +
        '<h2 class="sec">' + esc(A.title || "摘要") + '</h2>' +
        '<p class="sec-sub">' + esc(A.sub || "") + '</p>' +
        '<div class="abstract">' +
          A.paragraphs.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        '</div>' +
      '</div></section>'
    );
  }

  /* ---------- 方法 ---------- */
  var M = C.method || {};
  if (has(M.figure) || (M.points || []).length || has(M.caption)) {
    var fig = has(M.figure)
      ? (/\.(mp4|webm|mov)$/i.test(M.figure)
          ? '<video class="media tall" src="' + esc(M.figure) + '" controls muted loop playsinline></video>'
          : '<img class="media tall" src="' + esc(M.figure) + '" alt="方法框架图">')
      : '<div class="media tall"><div class="stack"><div>方法框架图</div><code>static/images/method.png</code></div></div>';

    var points = (M.points || []).map(function (p, i) {
      return '<div class="point"><div class="n">' + (i + 1) + '</div>' +
        '<h4>' + esc(p.title) + '</h4><p>' + esc(p.text) + '</p></div>';
    }).join("");

    out.push(
      '<section id="method"><div class="wrap">' +
        '<h2 class="sec">' + esc(M.title || "方法概览") + '</h2>' +
        '<p class="sec-sub">' + esc(M.sub || "") + '</p>' +
        fig +
        (has(M.caption) ? '<p class="cap">' + esc(M.caption) + '</p>' : '') +
        (points ? '<div class="points" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' + points + '</div>' : '') +
      '</div></section>'
    );
  }

  /* ---------- 结果区 ---------- */
  (C.sections || []).forEach(function (sec, si) {
    var groups = (sec.groups || []).map(function (g) {
      var cols = Math.min(Math.max(Number(g.columns) || 4, 2), 4);
      var items = (g.items || []).map(function (it) {
        var tag = has(it.tag)
          ? '<span class="tag' + (it.tagClass ? " " + esc(it.tagClass) : "") + '">' + esc(it.tag) + '</span>'
          : "";

        var media;
        var type = it.type || "video";
        if (has(it.src) && type === "video") {
          media = '<video class="media tall" src="' + esc(it.src) + '"' +
            (has(it.poster) ? ' poster="' + esc(it.poster) + '"' : '') +
            ' controls muted loop playsinline preload="metadata"></video>';
        } else if (has(it.src) && type === "image") {
          media = '<img class="media tall" src="' + esc(it.src) + '" alt="' + esc(it.label) + '">';
        } else if (has(it.src) && type === "audio") {
          media = '<div class="media tall"><audio controls src="' + esc(it.src) + '" style="width:88%"></audio></div>';
        } else {
          var icon = type === "audio" ? "♪" : "▶";
          media = '<div class="media tall"><div class="stack"><div class="play">' + icon + '</div>' +
            '<code>' + esc(it.src || (type === "audio" ? "static/audio/xxx.wav" : "static/videos/xxx.mp4")) + '</code></div></div>';
        }

        return '<div class="tile"><div class="label"><b>' + esc(it.label || "") + '</b>' + tag + '</div>' +
          media + '</div>';
      }).join("");

      return '<div class="compare-group">' +
        ((has(g.title) || has(g.meta))
          ? '<div class="compare-head">' +
              (has(g.title) ? '<h4>' + esc(g.title) + '</h4>' : '') +
              (has(g.meta) ? '<span class="meta">' + esc(g.meta) + '</span>' : '') +
            '</div>'
          : '') +
        '<div class="grid-' + cols + '">' + items + '</div>' +
        '</div>';
    }).join("");

    out.push(
      '<section id="section-' + (si + 1) + '"><div class="wrap">' +
        (has(sec.title) ? '<h2 class="sec">' + esc(sec.title) + '</h2>' : '') +
        '<p class="sec-sub">' + esc(sec.sub || "") + '</p>' +
        groups +
        (has(sec.caption) ? '<p class="cap">' + esc(sec.caption) + '</p>' : '') +
      '</div></section>'
    );
  });

  /* ---------- 评价入口 ---------- */
  var K = C.cta || {};
  if (K.show !== false && has(K.title)) {
    out.push(
      '<section id="evaluate"><div class="wrap"><div class="cta">' +
        '<div class="txt"><h3>' + esc(K.title) + '</h3><p>' + esc(K.text || "") + '</p></div>' +
        '<div class="side"><a class="btn primary" href="' + esc(K.href || "./eval.html") + '">' +
          esc(K.button || "开始") + '</a></div>' +
      '</div></div></section>'
    );
  }

  /* ---------- BibTeX ---------- */
  var B = C.bibtex || {};
  if (has(B.text)) {
    out.push(
      '<section id="bibtex"><div class="wrap">' +
        '<h2 class="sec">' + esc(B.title || "引用") + '</h2>' +
        '<p class="sec-sub">' + esc(B.sub || "BibTeX") + '</p>' +
        '<pre class="bibtex">' + esc(B.text) + '</pre>' +
      '</div></section>'
    );
  }

  /* ---------- 页脚 ---------- */
  var F = C.footer || [];
  if (F.length) {
    out.push('<footer><div class="wrap">' +
      F.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      '</div></footer>');
  }

  root.innerHTML = out.join("");
})();
