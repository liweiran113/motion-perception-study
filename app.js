/* ===========================================================
   app.js —— pilot-1.1.2
   -----------------------------------------------------------
   pilot-1.1.2 增量（对齐研究方《GitHub 前端接入包 (2)》的视觉）：
     1. 入口页隐藏页眉（body:has(.intro)，独立排版）
     2. 步骤标识统一为"第 1 / 2 / 3 步"措辞；试次页标题
        "正式试次 x / 14"与进度条仍保持同步（不采纳接入包
        的 /15 分母，避免两数不一致）
     3. 四项评价改为行式布局：白色容器 + 每行 40/60、
        格内文字 + 原生单选；两段视频未看完前量表整体禁用
     4. 保留我们的门禁（"已完整观看"）、§22.11 字段、
        设备检查通过后才创建会话、无任何开发入口
   -----------------------------------------------------------
   pilot-1.1.1 增量（按《TrajPG主观实验网站首页修改需求》）：
     1. 相关经验改为选填：默认"请选择（可选）"，未选择时保存 null（§7.5）
     2. "匿名评分"统一改为"匿名评价"；按钮下方说明换为文档原文（§7.2/§7.6）
     3. 创建会话失败改为页内红字提示，不再用 alert；新增"返回上一步"
        且勾选状态不丢失（§10）
   -----------------------------------------------------------
   保留已经验证过的后端契约，不改变数据链路：
     API.start()      → rpc start_session
     API.getSession() → rpc get_session
     API.submit()     → rpc submit_scores
   -----------------------------------------------------------
   本版相对 §21/§22 重写版的实质变化：
     1. 知情同意按 §21.7 改为 2 项必选 + 经验 5 档（选填）
     2. 新增设备检查页（§21.7 / §21.8）：实测视频与声音后才创建会话
     3. 视频状态改为三态（§22.2），门禁以"已完整观看"为准
     4. 四个问题改用 §22.5 新措辞；量表改为矩阵布局（§22.7）
     5. 退出改"保存并稍后继续"并加确认框（§22.4）
     6. 彻底删除本地预览与"导入测试视频"入口（§22.9）
     7. 每试次记录 §22.11 的播放行为字段
     8. 刷新恢复改为向后端 get_session 取回分配（原 §9 / §13.2）
   =========================================================== */

const $ = (s, r = document) => r.querySelector(s);
const KEY = 'trajpg-study-v1';

/* §22.5 四个正式问题，措辞逐字取自文档，不得改写 */
const QUESTIONS = [
  '比较视频 A 与视频 B：就角色沿目标路径移动的准确性与连续性而言，请选择最符合你判断的相对程度。',
  '比较视频 A 与视频 B：就全身动作的协调自然程度以及脚部稳定性而言，请选择最符合你判断的相对程度。',
  '比较视频 A 与视频 B：就上肢手势和动作节奏与语音内容的匹配程度而言，请选择最符合你判断的相对程度。',
  '综合考虑路径遵循、动作自然性、足部稳定性和语音—手势匹配，请选择最符合你整体偏好的相对程度。'
];

/* §22.6 五级相对量表，顺序固定且左右对称；后台原始编码 1–5 */
const LABELS = ['视频 A 明显更好', '视频 A 稍好', '无明显差异', '视频 B 稍好', '视频 B 明显更好'];

/* 开发期占位媒体；正式素材接入后由服务端下发的匿名 URL 覆盖 */
const PLACEHOLDER = 'media/placeholder.mp4';

const BACKEND_ON = () => !!(window.API && window.API.enabled && window.API.enabled());

let session = null;
let videos = [newVideoState(), newVideoState()];
let enteredAt = 0;
let answerEnabledAt = null;
/* 首页勾选状态暂存：创建会话失败返回首页时不丢失（首页修改需求 §10） */
let consentState = { age: false, join: false, exp: '' };

function newVideoState() {
  return { state: 'idle', plays: 0, startedAt: null, watchMs: 0, playFrom: 0, completed: false, error: null };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (e) { /* 隐私模式忽略 */ }
}

/* ---------------- 启动 ---------------- */

(async function boot() {
  try { session = JSON.parse(localStorage.getItem(KEY)); } catch (e) { session = null; }
  if (!BACKEND_ON()) return configError();
  if (!session || session.backend !== 'supabase') { session = null; return intro(); }
  await resume();
  if (session.completed_at) return complete();
  intro();
})();

/* 刷新 / 重开页面时以后端分配为准（原需求 §9、§13.2） */
async function resume() {
  try {
    const d = await API.getSession(session.participant_id);
    if (!d || !Array.isArray(d.trials) || d.trials.length !== 15) {
      throw new Error('服务器返回的试次结构不完整');
    }
    session.trials = d.trials;
    session.participant_serial = d.participant_serial;
    /* 已写库的试次数 = 下一次该做的位置；增量提交保证不会跳题 */
    session.index = Math.min(Object.keys(d.ratings || {}).length, 15);
    session.draft = {};
    session.resume_count = (session.resume_count || 0) + 1;
    if (d.completed) session.completed_at = session.completed_at || new Date().toISOString();
    session.resumeError = null;
    save();
  } catch (e) {
    session.resumeError = e.message || String(e);
  }
}

function configError() {
  $('#app').innerHTML = `
    <section class="card center">
      <h2>研究服务器未配置</h2>
      <p>本页面需要连接研究服务器才能记录评分，当前配置不完整。请联系研究者。</p>
      <p class="muted">请勿在未连接服务器的情况下开展正式评价。</p>
    </section>`;
}

/* ---------------- 首页（§21） ---------------- */

function intro() {
  const canResume = session && session.backend === 'supabase' && !session.completed_at;
  const resumeBar = canResume
    ? `<div class="resume-bar"><span>检测到未完成的匿名评价。</span><button class="secondary" id="resume">继续上次评价</button></div>`
    : '';

  $('#app').innerHTML = `
  <div class="intro">
    <section>
      <div class="eyebrow">研究说明 · 第 1 步（共 3 步）</div>
      <h1>语音驱动全身动作感知评价</h1>
      <p class="lead">你将观看若干组成对呈现的匿名动作视频，并根据直观感受评价路径遵循、动作自然性、语音—手势匹配和整体表现。无需相关专业背景。</p>
      <div class="stats">
        <div><strong>约 15–22 分钟</strong><small>预计用时</small></div>
        <div><strong>12 个正式比较</strong><small>另含练习与质量检查</small></div>
        <div><strong>4 项评价</strong><small>每组视频分别作答</small></div>
      </div>
      <ol class="steps">
        <li><b>01</b>阅读说明并确认自愿参与</li>
        <li><b>02</b>依次观看匿名视频 A 与视频 B</li>
        <li><b>03</b>完成四项相对评价并提交</li>
      </ol>
    </section>

    <section class="card consent-card">
      ${resumeBar}
      <h2>研究说明与参与确认</h2>
      <p>本研究比较不同方法生成的语音驱动全身动作。你将观看匿名视频对，并分别评价路径遵循、动作自然性与足部稳定性、语音—手势匹配和整体表现。</p>
      <ul>
        <li>预计用时约 15–22 分钟。</li>
        <li>参与完全自愿，在最终提交前可随时退出。</li>
        <li>系统不收集姓名、手机号、邮箱或身份证等身份信息。</li>
        <li>匿名评价仅用于学术研究、汇总分析和论文报告。</li>
      </ul>
      <form id="consent">
        <label class="check"><input type="checkbox" name="age"${consentState.age ? ' checked' : ''}><span>我已年满 18 周岁，并已阅读上述研究说明。</span></label>
        <label class="check"><input type="checkbox" name="join"${consentState.join ? ' checked' : ''}><span>我自愿参加本研究，并同意匿名评价用于学术研究与汇总分析。</span></label>

        <label class="field"><span>你的相关经验</span>
          <select id="experience">
            <option value=""${consentState.exp ? '' : ' selected'} disabled>请选择（可选）</option>
            <option value="none"${consentState.exp === 'none' ? ' selected' : ''}>没有相关经验</option>
            <option value="concepts"${consentState.exp === 'concepts' ? ' selected' : ''}>了解少量相关概念</option>
            <option value="projects"${consentState.exp === 'projects' ? ' selected' : ''}>有学习或项目经验</option>
            <option value="professional"${consentState.exp === 'professional' ? ' selected' : ''}>从事相关研究或专业工作</option>
            <option value="unspecified"${consentState.exp === 'unspecified' ? ' selected' : ''}>不确定 / 不愿回答</option>
          </select>
        </label>

        <button class="primary" id="begin" disabled>同意并开始设备检查</button>
        <p class="muted button-note">下一步将测试视频与声音播放，不计入正式结果；进度以匿名编号保存。</p>
      </form>
    </section>
  </div>`;

  const form = $('#consent');
  const begin = $('#begin');
  const sync = () => {
    consentState = { age: form.age.checked, join: form.join.checked, exp: $('#experience').value || '' };
    begin.disabled = !(form.age.checked && form.join.checked);
  };
  form.onchange = sync;
  form.onsubmit = (e) => { e.preventDefault(); sync(); deviceCheck(); };
  sync();

  if (canResume) {
    $('#resume').onclick = async () => {
      if (session.resumeError) await resume();
      if (session.resumeError) {
        return alert('无法连接研究服务器：' + session.resumeError + '\n\n请检查网络后重试。你的进度保存在服务器上，不会丢失。');
      }
      if (session.index >= 15 || session.completed_at) return complete();
      render();
    };
  }
}

/* ---------------- 设备检查（§21.7 / §21.8） ---------------- */

function deviceCheck() {
  const experience = $('#experience').value;

  $('#app').innerHTML = `
  <section class="card device-card">
    <div class="eyebrow">设备检查 · 第 2 步（共 3 步）</div>
    <h2>测试视频与声音播放</h2>
    <p>请点击播放下面这段测试视频，确认你能清楚看到画面，并且能听到声音。本步骤不计入正式结果。</p>
    <div class="video-card" style="margin:18px 0">
      <div class="video-title"><b>测试视频</b><small class="state" id="dstate">尚未播放</small></div>
      <video id="dvideo" controls controlslist="nodownload" playsinline preload="metadata"></video>
      <p class="error" id="derr"></p>
    </div>
    <label class="check"><input type="checkbox" id="dok" disabled><span>我可以看到画面，并能听到声音。</span></label>
    <button class="primary" id="dnext" disabled>进入练习</button>
    <button class="secondary" id="dback" style="width:100%;margin-top:10px">返回上一步</button>
    <p class="muted">如无法播放或听不到声音，请更换浏览器（建议 Chrome 或 Edge）、检查音量后重试。</p>
    <p class="error" id="dstart-err" style="margin-top:12px"></p>
  </section>`;

  const v = $('#dvideo');
  const okBox = $('#dok');
  const next = $('#dnext');
  const state = $('#dstate');
  let seen = false;

  v.src = PLACEHOLDER;
  v.onloadedmetadata = () => { if (!seen) state.textContent = '可以播放'; };
  v.onplay = () => { seen = true; state.textContent = '播放中'; state.dataset.state = 'playing'; };
  v.onended = () => {
    okBox.disabled = false;
    state.textContent = '已完整观看';
    state.dataset.state = 'done';
  };
  v.onerror = () => {
    state.textContent = '加载失败';
    $('#derr').textContent = '测试视频加载失败。请检查网络后刷新页面，或更换浏览器重试。';
  };
  okBox.onchange = () => { next.disabled = !(okBox.checked && seen); };

  $('#dback').onclick = () => intro();
  next.onclick = () => startSession(experience);
}

/* ---------------- 创建会话（服务端冻结分配） ---------------- */

async function startSession(experience) {
  const btn = $('#dnext');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '正在创建会话…';

  /* 《首页修改需求》§7.5：未选择经验时保存 null，不保存任何默认类别 */
  const exp = experience || null;

  try {
    const r = await API.start({ expertise: exp, age: true, consent: true, audio: true });
    if (!r || !Array.isArray(r.trials) || r.trials.length !== 15) {
      throw new Error('服务器返回的试次结构不完整');
    }
    session = {
      participant_id: r.participant_id,
      participant_serial: r.participant_serial,
      study_id: API.config.studyId,
      experience_level: exp,
      trials: r.trials,
      index: 0,
      answers: [],
      draft: {},
      resume_count: 0,
      backend: 'supabase'
    };
    save();
    render();
  } catch (e) {
    /* §10：失败停在当前页、给出具体原因、不丢勾选状态（可返回上一步重试） */
    btn.disabled = false;
    btn.textContent = old;
    const err = $('#dstart-err');
    if (err) err.textContent = '无法连接研究服务器：' + (e.message || e) + '。请检查网络后重试；若持续失败，请联系研究者。';
  }
}

/* ---------------- 试次页（§22） ---------------- */

function render() {
  if (!session) return intro();
  if (session.completed_at) return complete();

  const t = session.trials[session.index];
  const isPractice = session.index === 0;
  const isAttention = t.trial_type === 'attention';
  const isLast = session.index === 14;

  videos = [newVideoState(), newVideoState()];
  answerEnabledAt = null;
  enteredAt = Date.now();

  let media = [t.media_left_url || '', t.media_right_url || ''];
  if (!media[0] && !media[1]) media = [PLACEHOLDER, PLACEHOLDER];

  /* §22.3 进度：数字与进度条同步，且不暴露注意力检查的位置 */
  const doneCount = isPractice ? 0 : session.index;
  const pct = Math.round(doneCount / 14 * 100);
  const eyebrow = '评价 · 第 3 步（共 3 步）';
  const title = isPractice ? '练习试次（不计入正式统计）' : `正式试次 ${doneCount} / 14`;

  $('#app').innerHTML = `
  <div class="trial-top">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h2>${title}</h2>
    </div>
    <button class="secondary" id="exit">保存并稍后继续</button>
  </div>

  <div class="progress" role="progressbar" aria-label="正式评价进度"
       aria-valuemin="0" aria-valuemax="14" aria-valuenow="${doneCount}">
    <i style="width:${pct}%"></i>
  </div>

  <div class="notice">${isAttention
    ? '这是注意力检查。请在下面四个问题中全部选择“无明显差异”。'
    : '请先完整播放视频 A 和视频 B，再根据直观感受回答四个问题。视频可以重复播放，评价没有标准答案。'}</div>

  <div class="videos">
    ${[0, 1].map(i => `
      <section class="video-card">
        <div class="video-title">
          <b>视频 ${i ? 'B' : 'A'}</b>
          <small class="state" id="st${i}">尚未播放</small>
        </div>
        <video id="v${i}" controls controlslist="nodownload" playsinline preload="metadata" src="${media[i]}"></video>
        <p class="error" id="err${i}"></p>
      </section>`).join('')}
  </div>

  <div class="questions">
    ${QUESTIONS.map((q, qi) => `
      <section class="question" role="radiogroup" aria-labelledby="q${qi}">
        <h3 id="q${qi}">${q}</h3>
        <div class="scale">
          ${LABELS.map((l, oi) => `
            <label>
              <input type="radio" name="q${qi}" value="${oi + 1}" aria-label="${l}"${session.draft[qi] === oi + 1 ? ' checked' : ''}>
              <span>${l}</span>
            </label>`).join('')}
        </div>
      </section>`).join('')}
  </div>

  <div class="actions">
    <span class="hint" id="hint">请完整播放两个视频并完成四项评价</span>
    <button id="next" disabled>${isLast ? '检查并提交' : '下一试次'}</button>
  </div>

  <dialog id="exitDlg">
    <h2>保存并稍后继续</h2>
    <p>当前已完成的作答将保存。你可以稍后使用同一浏览器继续，尚未提交的当前试次不会计入正式结果。</p>
    <div class="row">
      <button class="secondary" id="exitCancel">继续作答</button>
      <button id="exitConfirm">保存并退出</button>
    </div>
  </dialog>

  <dialog id="confirmDlg">
    <h2>${isPractice ? '练习已完成' : '确认提交'}</h2>
    <p>${isPractice
      ? '下面开始正式匿名比较。正式部分共 12 个视频比较，另含 2 个质量检查。'
      : '所有试次均已完成。提交后本轮评价即结束，无法再次修改。'}</p>
    <div class="row">
      <button class="secondary" id="backCheck">返回检查</button>
      <button id="confirmOk">${isPractice ? '开始正式比较' : '确认提交'}</button>
    </div>
  </dialog>`;

  bindVideos(media);
  bindAnswers();

  $('#exit').onclick = () => $('#exitDlg').showModal();
  $('#exitCancel').onclick = () => $('#exitDlg').close();
  $('#exitConfirm').onclick = () => { $('#exitDlg').close(); save(); intro(); };

  $('#next').onclick = () => {
    if (!ready()) return;
    if (session.index === 0 || isLast) $('#confirmDlg').showModal();
    else advance();
  };
  $('#confirmOk').onclick = () => { $('#confirmDlg').close(); advance(); };
  $('#backCheck').onclick = () => $('#confirmDlg').close();

  window.scrollTo(0, 0);
  update();
}

function bindVideos(media) {
  [0, 1].forEach(i => {
    const v = $('#v' + i);
    const st = $('#st' + i);

    v.onplay = () => {
      const other = $('#v' + (1 - i));
      if (other && !other.paused) other.pause();   /* 播放互斥，避免语音重叠 */
      videos[i].plays += 1;
      videos[i].state = 'playing';
      if (!videos[i].startedAt) videos[i].startedAt = new Date().toISOString();
      videos[i].playFrom = Date.now();
      st.textContent = '播放中';
      st.dataset.state = 'playing';
      update();
    };

    const stopClock = () => {
      if (videos[i].playFrom) {
        videos[i].watchMs += Date.now() - videos[i].playFrom;
        videos[i].playFrom = 0;
      }
    };

    v.onpause = () => {
      stopClock();
      if (videos[i].state === 'playing') {
        videos[i].state = 'paused';
        st.textContent = '尚未看完';
        st.dataset.state = 'idle';
      }
    };

    v.onended = () => {
      stopClock();
      videos[i].state = 'done';
      videos[i].completed = true;
      st.textContent = '已完整观看';
      st.dataset.state = 'done';
      update();
    };

    v.onerror = () => {
      stopClock();
      videos[i].state = 'error';
      videos[i].completed = false;
      videos[i].error = (v.error && v.error.code) || -1;
      st.textContent = '加载失败';
      st.dataset.state = 'idle';
      $('#err' + i).textContent = '视频加载失败。请刷新页面重试；若反复失败请联系研究者，并说明是视频 ' + (i ? 'B' : 'A') + '。';
      update();
    };

    if (!media[i]) $('#err' + i).textContent = '视频地址未配置。';
  });
}

function bindAnswers() {
  document.querySelectorAll('.scale input[type=radio]').forEach(r => {
    r.onchange = () => {
      const qi = Number(r.name.slice(1));
      session.draft[qi] = Number(r.value);
      save();
      update();
    };
  });
}

/* 门禁：两段视频都"已完整观看"，且四项都作答（§22.2 / 原 §6.3 / §15.2） */
function ready() {
  return videos.every(v => v.completed && v.state !== 'error')
    && [0, 1, 2, 3].every(i => Number.isInteger(session.draft[i]));
}

function update() {
  const next = $('#next');
  const hint = $('#hint');
  if (!next) return;
  const ok = ready();
  /* 两段视频未看完前，量表整体禁用（接入包行为：灰态格子不可点） */
  const watched = videos.every(v => v.completed && v.state !== 'error');
  document.querySelectorAll('.scale input[type=radio]').forEach(r => { r.disabled = !watched; });
  if (ok && !answerEnabledAt) answerEnabledAt = new Date().toISOString();
  next.disabled = !ok;
  if (hint) hint.textContent = ok ? '本试次已完成，可以继续' : '请完整播放两个视频并完成四项评价';
}

/* ---------------- 提交（§22.11 记录播放行为） ---------------- */

async function advance() {
  if (!ready()) return;

  const t = session.trials[session.index];
  const rt = Date.now() - enteredAt;

  const rating = {
    trial_id: t.trial_id,
    path_score: session.draft[0],
    motion_score: session.draft[1],
    speech_score: session.draft[2],
    overall_score: session.draft[3],
    response_time_ms: rt,
    trial_response_time_ms: rt,
    video_a_started_at: videos[0].startedAt,
    video_b_started_at: videos[1].startedAt,
    video_a_completed: !!videos[0].completed,
    video_b_completed: !!videos[1].completed,
    video_a_play_count: videos[0].plays,
    video_b_play_count: videos[1].plays,
    video_a_watch_seconds: Math.round(videos[0].watchMs / 1000),
    video_b_watch_seconds: Math.round(videos[1].watchMs / 1000),
    answer_enabled_at: answerEnabledAt,
    trial_submitted_at: new Date().toISOString(),
    resume_count: session.resume_count || 0,
    video_error_code: videos.map(v => v.error).filter(Boolean).join(',') || null
  };

  const isLast = session.index === 14;
  const btn = $('#next');
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '正在保存…'; }

  try {
    const ack = await API.submit(session.participant_id, [rating], isLast);
    if (isLast) session.ack = ack || {};
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = old; }
    alert('提交失败：' + (e.message || e) + '\n\n你的答案仍在本机，请重试；若反复失败请联系研究者。');
    return;
  }

  session.answers.push(Object.assign({}, t, rating, { trial_order: session.index + 1 }));
  session.draft = {};
  session.index += 1;
  if (session.index === 15) session.completed_at = new Date().toISOString();
  save();
  render();
}

/* ---------------- 完成页 ---------------- */

function complete() {
  const serial = session.participant_serial;
  const shortId = session.participant_id ? String(session.participant_id).slice(0, 8) : '';
  const invalid = session.ack && session.ack.valid_participant === false;

  $('#app').innerHTML = `
  <section class="card center">
    <div class="done-mark">评价已完成</div>
    <h1 style="font-size:32px">感谢你的认真评价</h1>
    <p>15 个试次已全部提交，你的评分已匿名记录至研究服务器。</p>
    <p>匿名参与编号：<span class="serial">${serial !== undefined && serial !== null ? '#' + serial : shortId}</span>
      <span class="muted">（${shortId}）</span></p>
    ${invalid ? '<p class="muted">本次记录中的质量检查未全部通过，可能不计入最终分析，但原始记录仍会保留。</p>' : ''}
    <p class="muted">你现在可以关闭此页面。如需补充说明，请联系研究者。</p>
  </section>`;
}
