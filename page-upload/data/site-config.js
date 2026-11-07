/* ===========================================================
   页面内容配置 —— 展示页的所有文字都在这里
   -----------------------------------------------------------
   改这里 = 改网站。不需要碰 HTML。
   admin.html 的「页面内容」页签可以直接可视化编辑并一键发布。
   =========================================================== */

window.SITE_CONFIG = {
  /* 浏览器标签页标题 / 分享到社交平台时的描述 */
  meta: {
    title: "Speech-Driven Personalized Gesture Synthesis · 项目主页",
    description: "语音驱动个性化手势合成的论文项目主页：视频对比与主观评价。"
  },

  /* 顶部提示条；正式上线时把 show 改成 false 即可隐藏 */
  demoBar: {
    show: true,
    strong: "模板示例",
    text: "页面文字与视频均为占位内容，可用 admin.html 修改。评价可用，但数据暂存在本地浏览器。"
  },

  /* 主题色：会覆盖链接色和主按钮色 */
  theme: { accent: "#209cee" },

  /* ---------- 头部 ---------- */
  hero: {
    eyebrow: "IEEE TVCG 2026",
    title: "Speech-Driven Personalized Gesture Synthesis Without Style Labels",
    subtitle: "一篇关于语音驱动 3D 全身手势生成的论文 —— 这里是它的项目主页模板",
    authors: [
      { name: "作者一", url: "#", affil: "1" },
      { name: "作者二", url: "#", affil: "2" },
      { name: "作者三", url: "#", affil: "1" },
      { name: "通讯作者", url: "#", affil: "1" }
    ],
    affiliations: [
      { id: "1", text: "某某大学 计算机学院" },
      { id: "2", text: "某某研究院" }
    ],
    venue: "IEEE Transactions on Visualization and Computer Graphics (TVCG) · 2026",
    corresponding: "通讯作者邮箱：author@example.edu.cn",
    links: [
      { label: "论文 PDF", href: "#", icon: "▤", primary: false },
      { label: "arXiv", href: "#", icon: "◈", primary: false },
      { label: "代码", href: "#", icon: "⌘", primary: false },
      { label: "BibTeX", href: "#bibtex", icon: "❝", primary: false },
      { label: "参与主观评价", href: "./eval.html", icon: "★", primary: true }
    ]
  },

  /* ---------- 主视觉 ---------- */
  teaser: {
    src: "",
    poster: "",
    caption: "图 1：仅给定一段原始语音，模型即可生成与之节奏、语义、风格相匹配的 3D 全身手势。"
  },

  /* ---------- 摘要：每个元素一段 ---------- */
  abstract: {
    title: "摘要",
    sub: "Abstract",
    paragraphs: [
      "语音驱动的手势生成是虚拟人内容创作中的关键环节。现有方法通常依赖风格标签、参考动作片段或额外的文本模态来约束生成结果，既增加了使用成本，也把连续的风格空间压缩成了离散类别。本文提出一种仅以原始语音为输入的端到端框架，通过隐式特征推断自动获得连续的风格表示，并结合扩散 Transformer 进行整段序列的非自回归生成。",
      "在三个公开数据集上的客观指标与主观用户研究均表明，本方法在动作自然度、语音—动作同步性以及风格一致性上优于现有基线，且在真实场景语音（含背景噪声）下保持稳定。"
    ]
  },

  /* ---------- 方法 ---------- */
  method: {
    title: "方法概览",
    sub: "Method",
    figure: "",
    caption: "图 2：整体框架。语音特征经条件提取器得到统一隐变量，再通过 AdaLN Transformer 与扩散过程生成整段手势序列。",
    points: [
      { title: "隐式风格推断", text: "不依赖离散风格标签，从语音中自动推断连续的风格表示，降低输入成本。" },
      { title: "非自回归生成", text: "一次生成整段序列，避免逐帧递推带来的抖动与误差累积。" },
      { title: "条件调制", text: "用自适应层归一化把条件信息注入每一层，强化语音与动作的时序对齐。" }
    ]
  },

  /* ---------- 结果区（可多个，每个下面若干对比组） ---------- */
  sections: [
    {
      title: "定性结果",
      sub: "同一段语音输入下，不同方法生成结果的并排对比",
      caption: "把视频文件放进 static/videos/，在上面填相对路径即可播放。建议单条控制在 4MB 以内。",
      groups: [
        {
          title: "数据集 A · 情绪风格",
          meta: "输入语音：happy_01.wav",
          columns: 4,
          items: [
            { label: "输入", tag: "", tagClass: "", type: "placeholder", src: "static/audio/a1.wav" },
            { label: "GT", tag: "真实动作", tagClass: "gt", type: "video", src: "" },
            { label: "Ours", tag: "本文方法", tagClass: "ours", type: "video", src: "" },
            { label: "Baseline", tag: "对比方法", tagClass: "", type: "video", src: "" }
          ]
        },
        {
          title: "数据集 B · 个性差异",
          meta: "输入语音：speaker_07.wav",
          columns: 4,
          items: [
            { label: "输入", tag: "", tagClass: "", type: "placeholder", src: "static/audio/b1.wav" },
            { label: "GT", tag: "真实动作", tagClass: "gt", type: "video", src: "" },
            { label: "Ours", tag: "本文方法", tagClass: "ours", type: "video", src: "" },
            { label: "Baseline", tag: "对比方法", tagClass: "", type: "video", src: "" }
          ]
        }
      ]
    },
    {
      title: "泛化能力",
      sub: "真实场景语音（含背景噪声、非录音棚条件）",
      caption: "",
      groups: [
        {
          title: "",
          meta: "",
          columns: 2,
          items: [
            { label: "Case 1", tag: "街头采访片段", tagClass: "", type: "video", src: "" },
            { label: "Case 2", tag: "公开演讲片段", tagClass: "", type: "video", src: "" }
          ]
        }
      ]
    }
  ],

  /* ---------- 评价入口 ---------- */
  cta: {
    show: true,
    title: "参与主观评价",
    text: "约 5 分钟。你将看到若干组并排的无声动画片段，请凭第一印象判断哪一组更自然、更贴合语音。评价维度与题目都可在后台配置。",
    button: "开始评价 →",
    href: "./eval.html"
  },

  /* ---------- 引用 ---------- */
  bibtex: {
    title: "引用",
    sub: "BibTeX",
    text: "@article{author2026gesture,\n  title   = {Speech-Driven Personalized Gesture Synthesis Without Style Labels},\n  author  = {Author, First and Author, Second and Author, Third},\n  journal = {IEEE Transactions on Visualization and Computer Graphics},\n  year    = {2026},\n  volume  = {32},\n  number  = {10},\n  pages   = {1--14}\n}"
  },

  /* ---------- 页脚：每个元素一行 ---------- */
  footer: [
    "本页面基于 Nerfies 学术主页模板改写，采用 CC BY-SA 4.0 许可。",
    "页面中的视频与图片版权归论文作者所有。若需引用，请使用上方 BibTeX。"
  ]
};
