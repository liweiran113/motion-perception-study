# 后端接入指南（Supabase）

本目录的代码已经具备两种模式，由 `config.js` 一个字段切换：

| 模式 | config.js 里 | 数据去向 | 用途 |
|---|---|---|---|
| 本地预览 | `backend: "preview"` | 参与者自己的浏览器 | 给导师/组内演示 |
| 正式采集 | `backend: "supabase"` | **Supabase 数据库** | 收被试数据 |

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

打开网站，**完整答完一轮**（勾四项 → 选熟悉程度 → 15 个试次）：

- 每答一题右上角不会报错；最后一题会显示"评分已提交至研究服务器"
- 回 Supabase → **Table Editor**，检查三张表有数据：
  `participants`（1 行，`valid_participant` 为 true）、
  `trial_assignments`（15 行）、`ratings`（15 行）
- 刷新页面点"继续上次作答"：题目、左右顺序**完全不变**

## 五、导出数据（统计用）

用任意 HTTP 工具或浏览器控制台调用（在 Supabase 项目页面按 F12 也行）：

```js
fetch('https://xxxx.supabase.co/rest/v1/rpc/admin_export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: 'anonKey', Authorization: 'Bearer anonKey' },
  body: JSON.stringify({ p_token: '你设置的管理员令牌' })
}).then(r => r.json()).then(d => console.log(d))
```

返回的 JSON 覆盖需求文档 §14 的全部列（含每题的左右方法代码），
可直接转 CSV 分析。**令牌打错会返回错误，不会泄露数据。**

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
