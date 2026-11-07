# 论文项目主页 + 主观评价（模板）

给学姐的论文网站骨架。**页面内容与评价表单全部配置化，改字不用碰 HTML**；
纯静态、零依赖、零构建，`index.html` 双击就能打开；部署到 GitHub Pages 后全球可访问。

## 文件结构

```
project-page/
├── index.html            展示页壳子（不用改，内容全来自配置）
├── eval.html             评价页（被试在这里答题）
├── admin.html            站点后台：页面内容 + 评价表单 两个页签
├── assets/
│   ├── css/site.css      全部样式（Nerfies 风格），无 CDN 依赖
│   └── js/
│       ├── site.js       展示页渲染器（读配置拼页面）
│       ├── eval.js       评价逻辑（随机化/盲评/计时/提交）
│       └── admin.js      后台编辑器
├── data/
│   ├── site-config.js    ★ 页面所有文字/视频路径
│   └── eval-config.js    ★ 评价表单配置
└── static/videos/        视频放这里
```

## 本地预览

直接双击 `index.html`。没有 fetch，file:// 协议下一切正常。

- `eval.html` 正常流程：知情同意 → 答题 → 完成
- `eval.html#trial` 调试直达第一题（跳过同意页和"已提交"拦截）
- 提交数据暂存本机浏览器 `localStorage`，完成页可下载 JSON 备份

## 日常改内容（不用碰 HTML）

打开 `admin.html`，两个页签：

- **页面内容**：标题、作者、单位、按钮、摘要每一段、方法要点、
  结果区（区块 → 对比组 → 每一项的视频路径）、BibTeX、页脚、主题色。
- **评价表单**：维度、题目、量表、同意书、提交地址。

改完点「发布到 GitHub」，两个配置文件一次提交，Pages 一分钟左右自动重新部署；
或用「导出」按钮下载文件手动覆盖。

改完访问时如果没变化，让对方强刷一次（Ctrl+F5）——浏览器可能缓存了旧配置。

## 三步换成学姐的论文

1. `admin.html` → 页面内容 → 头部/摘要/引用，逐项替换成真实信息。
2. 视频压好后放进 `static/videos/`，在「结果区」每一项里填相对路径。
3. 评价表单页签里把题目换成她的素材，定好维度和量表。

## 部署到 GitHub Pages

1. 新建仓库（如 `xxx-paper-website`），把本目录全部推上去。
2. Settings → Pages → Branch 选 `main` / `(root)` → Save。
3. 几分钟后 `https://用户名.github.io/仓库名/` 生效。

注意：

- 单文件 < 100MB（硬限制），仓库总量建议 < 1GB，**视频务必先压缩**。
- 仓库建议公开。私有仓库的 Pages 需要 Pro 账号。
- 评价页已被 `noindex`。

## 视频压缩（强烈建议）

720p + CRF 26 一般能压到原来的 1/6～1/10，肉眼几乎无损：

```bash
# 有声视频
ffmpeg -i in.mp4 -vf scale=-2:720 -c:v libx264 -crf 26 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k out.mp4
# 无声动画片段（去掉 -c:a aac ... 直接 -an）
```

`+faststart` 让视频边下边播，对网络差的访问者很重要。

## Token 怎么生成（后台"发布到 GitHub"要用）

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token。
2. Repository access 只勾**这一个网站仓库**；Permissions 里只给
   `Contents: Read and write`；Expiration 建议 90 天。
3. 生成的 `github_pat_...` 粘贴进后台的 Token 框，勾"在本机记住"。

三条安全底线（后台页面上也有同样提醒）：

- 这个后台页面只在自己电脑上打开，**不要部署成公开链接**，否则等于交出写权限；
- token 权限收得越小越好：单仓库 + 仅 Contents + 短有效期；
- 一旦怀疑泄露，立刻去 Developer settings 撤销重来。

## 接真后台（收被试数据，等评价形式定下来再做）

`eval.js` 里已经留好了唯一的开关：`data/eval-config.js` 的 `submit.endpoint`。

- **Supabase（推荐）**：建一张表 `responses (id, data jsonb, created_at)`，
  开启 RLS 但只允许 INSERT；把 REST 地址填进 `endpoint` 即可，
  一行代码不用改。后台看数据用 Supabase 自带表格，导出 CSV 一键。
- **Formspree 等**：最快，但数据在第三方，且导出格式受限。

## 如果这套东西要交给别人

按"能不能直接拿走"分三块看：

| 部分 | 能否直接交付 | 对方还要做什么 |
|---|---|---|
| 展示页 | 能，全部在后台改 | 替换示例文字、填视频路径 |
| 评价页 | **能跑，但收不到数据** | 必须填 `submit.endpoint`，否则答卷只留在被试自己浏览器里 |
| 后台 | 能 | 用她自己的 GitHub token；**不要部署到公网** |

最容易被误解的一点：**页面打开正常 ≠ 数据收得到**。`endpoint` 为空时，
被试答完会看到"已完成"，数据写进的是他自己电脑的 localStorage，
学姐这边一条都看不到。交付前务必确认这一项。

交给别人时建议一起说清三件事：

1. **填 endpoint**：没有它，收数据这件事等于没做（见上一节）。
2. **用自己的 token**：不要把别人的 token 写进配置或截图里。
3. **后台只在自己电脑上开**：`admin.html` 一旦部署成公开链接，等于把仓库写权限公开。

## 上线收数据前的检查清单

- [ ] `blind: true`（页面上不出现方法名，正式盲评建议映射关系存服务端，而非写死在配置里）
- [ ] 有至少 1 道注意力检查题
- [ ] `submit.endpoint` 已配置（否则数据只在本机浏览器里）
- [ ] 同意书文案与伦理要求一致，不收集个人身份信息
- [ ] 用带 token 的专属链接发给被试（公开链接谁都能刷）
- [ ] 先自己完整答一遍，下载 JSON 检查字段是否符合预期
