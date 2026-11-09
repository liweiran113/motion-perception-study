# 后端接入指南（Supabase）

> **v1.1.1（2026-11-09）更新**：按《首页修改需求》§7.5，相关经验改为选填——
> 未选择时前端传 `p_expertise = null`，`start_session` 已放开 null 校验（选了仍校验取值）。
> **已在运行的库必须重跑一次 `supabase/schema.sql`**（函数逻辑变化，签名未变，无需 drop；幂等不清数据）。

> **v1.1.0（2026-11-08）更新**：前端已按《§21 首页与视觉语言规范》《§22 试次页规范》重写，
> 数据库新增 §22.11 的播放行为字段与五档 `experience_level`。
> **已在运行的库必须重新执行一次 `supabase/schema.sql`**（整段粘贴重跑即可，幂等、不清数据），
> 否则新前端提交评分会报"列不存在"。详见文末"升级步骤"。

本目录的代码为正式采集模式（`config.js` 里 `backend: "supabase"`）。
后端能力（服务端冻结分配、A/B 交换、注意力判定、防重复提交、管理员导出）
全部在 `supabase/schema.sql` 里，以 4 个数据库函数实现，前端只拿匿名数据。

---

## 一、开通 Supabase（约 10 分钟，免费）

1. 打开 https://supabase.com → Sign up。
   **用 Gmail 或 QQ 邮箱**，不要用学校邮箱（外发邮件受限，验证邮件可能收不到）。
2. New project：名字随意（如 `trajpg`），数据库密码**自己留一份**（只显示一次），
   Region 选 **Singapore** 或 **Tokyo**（国内延迟最低）。
3. 等项目初始化完成（约 2 分钟）。

## 二、建表（复制粘贴即可，零命令行）

进入项目左侧 **SQL Editor** → New query：

1. 打开本目录 `supabase/schema.sql`，**全文复制**进去 → Run。应显示 Success。
2. 打开 `supabase/seed.sql`，全文复制 → Run。
   （这是占位清单：视频都指向 `media/placeholder.mp4`，方法名全是匿名代号）
3. 设置管理员令牌（换成你自己的长随机串，用于以后导出 CSV）：

   ```sql
   insert into app_config(key, value) values ('admin_token', '换成你自己的长随机串')
   on conflict (key) do update set value = excluded.value;
   ```

## 三、连到前端

1. 左下 **Project Settings → API**，复制两样东西：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public key**（一长串 `eyJ...`）
2. 编辑 `config.js`：

   ```js
   backend: "supabase",
   supabase: { url: "https://xxxx.supabase.co", anonKey: "eyJ..." }
   ```

   > anon key 是公开密钥（受数据库行级安全约束），放进 GitHub 仓库是安全的。
   > **绝对不能**放上去的是 service_role key 和 admin_token。

3. 把改动提交到 GitHub（网页编辑 `config.js` 直接改也行）。
4. Pages 自动重新部署（约 1 分钟）。

## 四、验收（缺这步等于没接）

打开网站，**完整答完一轮**（勾两项同意 → 通过设备检查 → 选熟悉程度 → 15 个试次）：

- 每答一题右上角不会报错；最后一题会显示"评分已提交至研究服务器"
- 回 Supabase → **Table Editor**，检查三张表有数据：
  `participants`（1 行，`valid_participant` 为 true）、
  `trial_assignments`（15 行）、`ratings`（15 行）
- 刷新页面点"继续上次作答"：题目、左右顺序**完全不变**

## 五、查看与导出数据（统计用）

### 方式 A：本机导出页（推荐，双击就能用）

打开 `tools/export.html`（**只在本机打开，不要部署**）：

1. 填 Project URL、publishable key、admin_token（可勾选"记住"）
2. 点「拉取数据」→ 页面直接显示：参与人数 / 有效人数 / 各单元样本均衡情况 / 参与者状态表 / 评分明细
3. 点「下载 participants.csv」「下载 ratings.csv」拿去 SPSS / R / Excel

`ratings.csv` 每行一次评分，含比较单元、路径、左右方法代码、四个分数、用时。
分析时先按 `valid_participant = true` 筛，练习题（`trial_type=practice`）不计入统计。

### 方式 B：命令行脚本（同样功能，可定时批量跑）

```
node tools/export_csv.mjs --url https://xxxx.supabase.co --key sb_publishable_xxx --token 你的admin_token --out ./export
```

产出 `participants.csv`、`ratings.csv`、`raw.json`（原始备份），并打印样本均衡检查。

### 方式 C：Supabase 后台直接看

**Table Editor** → 三张表：

| 表 | 内容 |
|---|---|
| `participants` | 每人一行：序号、是否定稿、注意力失败数、有效性 |
| `trial_assignments` | 每人 15 行：题目分配（含左右媒体） |
| `ratings` | 每次评分：四个分数 + 用时 |

想在 SQL Editor 里直接看"人 × 题"的合并视图：

```sql
select p.participant_serial as 序号, p.valid_participant as 有效,
       t.trial_order as 题序, t.trial_type as 类型, t.comparison_id as 单元,
       t.method_left as 左方法, t.method_right as 右方法,
       r.path_score as 路径, r.motion_score as 动作,
       r.speech_score as 语音, r.overall_score as 整体,
       r.response_time_ms as 用时ms
from participants p
join trial_assignments t using (participant_id)
left join ratings r on r.participant_id = p.participant_id and r.trial_id = t.trial_id
where t.trial_type = 'formal'
order by p.participant_serial, t.trial_order;
```

> **注意**：`admin_export` 返回 `method_left / method_right`（真实方法代码），
> 导出的 CSV 属于内部数据，不要公开发布。令牌打错只会报错，不会泄露数据。

## 六、正式数据来了之后

研究方提供 `public_trials.json` 后（私有映射、正式视频随后）：

1. `node tools/make_manifest.mjs --from public_trials.json`
   （工具在 `trajpg-experiment/tools/`，会自动校验公开清单不含真实方法名）
2. 重新生成的 `seed.sql` **只在 Supabase SQL Editor 里执行，不要提交仓库**
3. 正式视频放对象存储（COS / R2 / Supabase Storage 都行），URL 写进清单；
   前端 `config.js` 不用再动
4. 提升 `study_id` 版本号（schema.sql 里 `study_config` 同步改），再发正式链接

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 点开始弹"无法连接研究服务器" | config.js 的 url/anonKey 填错，或 schema.sql 没执行 |
| 弹"研究未启用" | seed.sql 没执行（study_config 里没有这个 study_id） |
| 提示"该参与者已提交" | 正常：每人只能交一次，测试用无痕窗口开新会话 |
| 答完最后一题没反应 | 看浏览器控制台报错；多半是 submit_scores 的校验被拦，错误信息会写明原因 |
| Supabase 免费项目暂停 | 7 天不活跃会休眠，去项目页点 Restore 即可，数据不丢 |

---

## 升级步骤（从 pilot-1.0.0 升到 pilot-1.1.0）

1. Supabase → SQL Editor → 整段重跑 `supabase/schema.sql`（幂等，不会清数据）。
   变化：
   - `participants` 新增 `experience_level`（五档）、`device_checked`；`expertise` 放宽为兼容列
   - `ratings` 新增 §22.11 的 13 个播放行为字段
   - `start_session` / `submit_scores` / `admin_export` 同步更新
   - 文件末尾的"增量迁移"段负责给已有库补列，新库上为 no-op
2. 上传新的前端文件到 GitHub 仓库根目录（覆盖，不要先删后传）：
   `index.html`、`style.css`、`app.js`、`config.js`、`README-BACKEND.md`。
   `api.js` 无改动；`media/`、`supabase/`、`tools/` 不变。
3. 用 Ctrl+F5 或隐身窗口验证线上版本。

**注意**：若以后修改任何函数的参数列表，必须先
`drop function if exists 函数名(旧参数类型);` 再 `create or replace`，
否则 Postgres 会新增一个重载而不是替换，导致调用混乱。
