/* ===========================================================
   评价配置 —— 这个文件就是"后台"
   -----------------------------------------------------------
   学姐改这里 = 改线上表单，不需要动任何代码。
   保存后刷新 eval.html 立即生效。

   想换成真后台（Supabase）时：把这个对象原样存进数据库表，
   eval.js 里改成 fetch 拉取即可，字段结构不用动。
   =========================================================== */

window.EVAL_CONFIG = {
  /* 问卷标识：换一次问卷就改一下，用来区分本地记录、防止重复提交 */
  surveyId: "demo-2026-v1",

  title: "手势生成结果主观评价",
  desc: "约 5 分钟。每组会并排播放 3 段无声动画，请根据第一印象作答，没有标准答案。",

  /* ---------- 知情同意 ---------- */
  consent: {
    required: true,
    text: [
      "感谢参与本次评价。本研究用于评估语音驱动手势生成方法的视觉效果，属于学术研究用途。",
      "你将观看若干段短视频（无声），并就动作自然度、语音匹配度等方面做出判断。全程约 5 分钟，可随时关闭页面退出，已作答内容不会被保存。",
      "本问卷不收集姓名、手机号、身份证号等可识别个人身份的信息。系统仅记录答题内容、作答耗时与浏览器类型，用于数据质量核查。",
      "提交即表示你已了解上述内容并同意参与。如有疑问，可联系研究者：author@example.edu.cn。"
    ]
  },

  /* ---------- 评价形式 ----------
     "pairwise" 成对/多选一比较：每题从多个方案里选一个，或选"无偏好"
     "likert"   逐条打分：每个方案在每个维度上单独打分
  */
  mode: "pairwise",

  /* 盲评：true 时页面只显示"方案 1/2/3"，不暴露模型名。
     正式收数据请务必保持 true，否则被试会被方法名带偏。 */
  blind: true,

  /* ---------- 评价维度（想改几个就改几个） ---------- */
  dimensions: [
    {
      id: "humanlikeness",
      label: "自然度",
      hint: "动作像真人吗？有没有明显抖动、穿模、不自然的姿态？"
    },
    {
      id: "appropriateness",
      label: "语音匹配度",
      hint: "动作的节奏、重音、语义是否和语音对得上？"
    },
    {
      id: "style",
      label: "风格一致性",
      hint: "同一说话人的动作风格是否前后统一、有辨识度？"
    }
  ],

  /* 成对比较计分：被选中的方案得 chosen 分，其余各得 others 分，无偏好得 tie 分 */
  pairwiseScale: { chosen: 2, others: -1, tie: 0 },

  /* 逐条打分计分（mode = "likert" 时生效） */
  likertScale: {
    min: 1,
    max: 5,
    labels: ["很差", "较差", "一般", "较好", "很好"]
  },

  /* 是否必须全部作答才能进入下一题 */
  requireAll: true,

  /* ---------- 题目 ----------
     每组 = 一段输入语音 + 若干段待比较的视频。
     video 留空则显示占位框，方便先看样式。
     model 字段只在 blind = false 时才会显示出来。
  */
  trials: [
    {
      id: "t1",
      title: "第 1 组 · 情绪表达",
      audio: "",
      options: [
        { key: "gt", model: "GT", video: "" },
        { key: "ours", model: "Ours", video: "" },
        { key: "base", model: "Baseline", video: "" }
      ]
    },
    {
      id: "t2",
      title: "第 2 组 · 个性差异",
      audio: "",
      options: [
        { key: "gt", model: "GT", video: "" },
        { key: "ours", model: "Ours", video: "" },
        { key: "base", model: "Baseline", video: "" }
      ]
    },
    {
      id: "t3",
      title: "第 3 组 · 语义相关",
      audio: "",
      options: [
        { key: "gt", model: "GT", video: "" },
        { key: "ours", model: "Ours", video: "" },
        { key: "base", model: "Baseline", video: "" }
      ]
    },
    {
      id: "t4",
      title: "第 4 组 · 真实场景语音",
      audio: "",
      options: [
        { key: "gt", model: "GT", video: "" },
        { key: "ours", model: "Ours", video: "" },
        { key: "base", model: "Baseline", video: "" }
      ]
    }
  ],

  /* ---------- 注意力检查 ----------
     每隔 attentionEvery 组插入一道，用于筛掉乱点的答卷。
     这些题的答案在提交时会被核对并单独标注。
  */
  attentionEvery: 2,
  attention: [
    {
      id: "ac1",
      question: "为了确认你正在认真观看，请在这道题选择「非常同意」。",
      options: ["非常同意", "同意", "不同意"],
      answer: "非常同意"
    }
  ],

  /* ---------- 数据提交 ----------
     endpoint 为空：数据只存在本机浏览器，页面最后会提供 JSON 下载。
     endpoint 填了地址（Formspree / Supabase Edge Function 等）：
     直接以 POST JSON 提交，失败时会提示并允许下载备份。
  */
  submit: {
    endpoint: "",
    method: "POST"
  }
};
