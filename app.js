/* ===========================================================
   app.js —— pilot-1.2.0（Track A：五条件 × 每人 8 对 × 四项评价）
   -----------------------------------------------------------
   本版对应《最终修改要求》（2026-11-10 协议修订）：
     1. 20 个正式视频（v001–v020）接入；页面只显示「视频 A / 视频 B」，
        条件编号与变体代号只存在于数据库，不下发语义
     2. 正式比较改为 8 对；练习 1 个 + 质量检查 2 个，共 11 个试次
     3. 四题改为：动作自然性 / 足部稳定性 / 语音—手势匹配 / 整体表现
        （移除“路径遵循”，网格只是空间参照）
     4. 完整观看判定改为按实际播放覆盖度计（拖到结尾不算看完）
     5. 视频加载失败可重试，不自动填分、不丢已有作答
     6. 首页文案、概览条、完成条件与统计分母同步为 8
   -----------------------------------------------------------
   数据链路不变（服务端冻结分配，刷新不重随机）：
     API.start()      → rpc start_session
     API.getSession() → rpc get_session
     API.submit()     → rpc submit_scores
   =========================================================== */

const $ = (s, r = document) => r.querySelector(s);
const KEY = 'trajpg-study-v1';

/* 协议常量：任何一处改数字，都需要同步数据库（schema.sql 里的组方案与校验） */
const TOTAL_FORMAL = 8;    // 正式比较数
const TOTAL_ATTENTION = 2; // 质量检查数
const TOTAL_TRIALS = TOTAL_FORMAL + TOTAL_ATTENTION + 1; // 含 1 个练习

/* 四道正式问题，措辞取自《最终修改要求》§4 */
const QUESTIONS = [
  '动作自然性：哪个视频中的全身动作更加自然、连贯，身体各部位的运动更加协调？',
  '足部稳定性：哪个视频中的足部在支撑阶段更加稳定，明显的滑动或漂移更少？',
  '语音—手势匹配：哪个视频中的手势节奏和动作变化，与语音的节奏、重音和停顿更加协调？',
  '整体表现：综合动作自然性、足部稳定性和语音—手势匹配，哪个视频的整体表现更好？'
];

/* 五级相对量表，顺序固定且左右对称；后台原始编码 1–5 */
const LABELS = ['视频 A 明显更好', '视频 A 略好', '无明显差异', '视频 B 略好', '视频 B 明显更好'];

/* 设备检查用的测试片（真实素材，含语音；本步骤不计入结果） */
const TEST_VIDEO = 'videos/v001.mp4';

/* ?test=1 → 本次记录在数据库里标记为测试数据，正式分析时排除 */
const TEST_MODE = new URLSearchParams(location.search).get('test') === '1';

const BACKEND_ON = () => !!(window.API && window.API.enabled && window.API.enabled());

let session = null;
let videos = [newVideoState(), newVideoState()];
let enteredAt = 0;
let answerEnabledAt = null;
/* 首页勾选状态暂存：创建会话失败返回首页时不丢失 */
let consentState = { age: false, join: false, exp: '' };

function newVideoState() {
  return {
    state: 'idle', plays: 0, startedAt: null,
    watchMs: 0, covered: 0, lastTime: 0,
    completed: false, error: null
  };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (e) { /* 隐私模式忽略 */ }
}

/* ---------------- 启动 ---------------- */

(async function boot() {
  try { session = JSON.parse(localStorage.getItem(KEY)); } catch (e) { session = null; }
  if (!BACKEND_ON()) return configError();

  /* 旧协议（15 试次）留下的本机会话直接作废，避免与新结构错位 */
  if (session && (!Array.isArray(session.trials) || session.trials.length !== TOTAL_TRIALS)) {
    session = null;
    save();
  }
  if (!session || session.backend !== 'supabase') { session = null; return intro(); }

  await resume();
  if (session.completed_at) return complete();
  intro();
})();

/* 刷新 / 重开页面时以后端分配为准：比较、顺序、A/B 方位都不重随机 */
async function resume() {
  try {
    const d = await API.getSession(session.participant_id);
    if (!d || !Array.isArray(d.trials) || d.trials.length !== TOTAL_TRIALS) {
      throw new Error('服务器返回的试次结构不完整');
    }
    session.trials = d.trials;
    session.participant_serial = d.participant_serial;
    session.group_no = d.group_no;
    /* 已写库的试次数 = 下一次该做的位置；增量提交保证不会跳题 */
    session.index = Math.min(Object.keys(d.ratings || {}).length, TOTAL_TRIALS);
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
      <p>本页面需要连接研究服务器才能记录评价，当前配置不完整。请联系研究者。</p>
      <p class="muted">请勿在未连接服务器的情况下开展正式评价。</p>
    </section>`;
}

/* ---------------- 首页 ---------------- */

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
      <p class="lead">你将依次观看成对呈现的匿名动作视频，并评价动作自然性、足部稳定性、语音—手势匹配和整体表现。请佩戴耳机，在安静环境中完成评价。每组两个视频使用相同语音。</p>
      <div class="stats">
        <div><strong>10–15 分钟</strong><small>预计用时</small></div>
        <div><strong>8 个正式比较</strong><small>另含练习与质量检查</small></div>
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
      ${TEST_MODE ? '<p class="test-flag">测试模式：本次记录会标记为测试数据，不计入正式研究。</p>' : ''}
      <h2>研究说明与参与确认</h2>
      <p>本研究比较不同方法生成的语音驱动全身动作。你将观看匿名视频对，并分别评价四个方面：动作自然性、足部稳定性、语音—手势匹配和整体表现。</p>
      <ul>
        <li>预计用时 10–15 分钟，共 8 组正式比较，另有 1 组练习和 2 组质量检查。</li>
        <li>请佩戴耳机、在安静环境中观看；每组两个视频使用相同语音。</li>
        <li>如果无法分辨优劣，请选择“无明显差异”，这是有效答案，不是漏答。</li>
        <li>参与完全自愿，在最终提交前可随时退出；系统不收集任何身份信息。</li>
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
        <p class="muted button-note">下一步将测试视频与声音播放，不计入正式结果；进度以匿名编号保存在研究服务器上。</p>
        ${TEST_MODE ? '<button class="secondary" id="reset" type="button" style="width:100%;margin-top:10px">清除本机进度并重新开始（仅测试用）</button>' : ''}
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
  form.onsubmit = (e) => { e.preventDefault(); sync(); deviceCheck($('#experience').value); };
  sync();

  if (TEST_MODE && $('#reset')) {
    $('#reset').onclick = () => {
      try { localStorage.removeItem(KEY); } catch (e) {}
      session = null;
      intro();
    };
  }

  if (canResume) {
    $('#resume').onclick = async () => {
      if (session.resumeError) await resume();
      if (session.resumeError) {
        return alert('无法连接研究服务器：' + session.resumeError + '\n\n请检查网络后重试。你的进度保存在服务器上，不会丢失。');
      }
      if (session.index >= TOTAL_TRIALS || session.completed_at) return complete();
      render();
    };
  }
}

/* ---------------- 设备检查 ---------------- */

function deviceCheck(experience) {
  $('#app').innerHTML = `
  <section class="card device-card">
    <div class="eyebrow">设备检查 · 第 2 步（共 3 步）</div>
    <h2>测试视频与声音播放</h2>
    <p>请点击播放下面这段测试视频，确认你能清楚看到完整画面（包括腿和脚），并且能听到声音。本步骤不计入正式结果。</p>
    <div class="video-card" style="margin:18px 0">
      <div class="video-title"><b>测试视频</b><small class="state" id="dstate">尚未播放</small></div>
      <video id="dvideo" controls controlslist="nodownload" playsinline preload="metadata"></video>
      <p class="error" id="derr"></p>
      <button class="retry" id="dretry" hidden>重新加载</button>
    </div>
    <label class="check"><input type="checkbox" id="dok" disabled><span>我可以看到完整画面，并能听到声音。</span></label>
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

  const load = () => {
    $('#derr').textContent = '';
    $('#dretry').hidden = true;
    v.src = TEST_VIDEO;
    v.load();
  };
  load();

  v.onloadedmetadata = () => { if (!seen) state.textContent = '可以播放'; };
  v.onplay = () => { seen = true; state.textContent = '播放中'; state.dataset.state = 'playing'; };
  v.onended = () => {
    okBox.disabled = false;
    state.textContent = '已完整观看';
    state.dataset.state = 'done';
  };
  v.onerror = () => {
    state.textContent = '加载失败';
    $('#derr').textContent = '测试视频加载失败。请检查网络后重试，或更换浏览器。';
    $('#dretry').hidden = false;
  };
  $('#dretry').onclick = load;
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

  /* 相关经验为选填，未选择时保存 null */
  const exp = experience || null;

  try {
    const r = await API.start({
      expertise: exp, age: true, consent: true, audio: true, isTest: TEST_MODE
    });
    if (!r || !Array.isArray(r.trials) || r.trials.length !== TOTAL_TRIALS) {
      throw new Error('服务器返回的试次结构不完整');
    }
    session = {
      participant_id: r.participant_id,
      participant_serial: r.participant_serial,
      group_no: r.group_no,
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
    /* 失败停在当前页、给出具体原因、不丢勾选状态（可返回上一步重试） */
    btn.disabled = false;
    btn.textContent = old;
    const err = $('#dstart-err');
    if (err) err.textContent = '无法连接研究服务器：' + (e.message || e) + '。请检查网络后重试；若持续失败，请联系研究者。';
  }
}

/* ---------------- 试次页 ---------------- */

function formalDone(upto) {
  let n = 0;
  for (let i = 0; i < upto; i++) if (session.trials[i] && session.trials[i].trial_type === 'formal') n++;
  return n;
}

function render() {
  if (!session) return intro();
  if (session.completed_at) return complete();

  const t = session.trials[session.index];
  const isPractice = t.trial_type === 'practice';
  const isAttention = t.trial_type === 'attention';
  const isLast = session.index === TOTAL_TRIALS - 1;

  videos = [newVideoState(), newVideoState()];
  answerEnabledAt = null;
  enteredAt = Date.now();

  const media = [t.media_left_url || '', t.media_right_url || ''];
  const done = formalDone(session.index);
  const pct = Math.round(done / TOTAL_FORMAL * 100);
  const title = isPractice
    ? '练习试次（不计入正式结果）'
    : isAttention ? '质量检查' : `正式比较 ${Math.min(done + 1, TOTAL_FORMAL)} / ${TOTAL_FORMAL}`;

  const notice = isPractice
    ? '这是练习，不计入正式结果。请先完整播放视频 A 和视频 B，再回答四个问题，熟悉操作即可。'
    : isAttention
      ? '这是质量检查。请在下面四个问题中全部选择“无明显差异”。'
      : '请先完整播放视频 A 和视频 B，再根据直观感受回答四个问题。两个视频使用相同语音，可以重复播放、反复比较。';

  $('#app').innerHTML = `
  <div class="trial-top">
    <div>
      <div class="eyebrow">评价 · 第 3 步（共 3 步）</div>
      <h2>${title}</h2>
    </div>
    <button class="secondary" id="exit">保存并稍后继续</button>
  </div>

  <div class="progress" role="progressbar" aria-label="正式比较进度"
       aria-valuemin="0" aria-valuemax="${TOTAL_FORMAL}" aria-valuenow="${done}">
    <i style="width:${pct}%"></i>
  </div>

  <div class="notice">${notice}</div>

  <div class="videos">
    ${[0, 1].map(i => `
      <section class="video-card">
        <div class="video-title">
          <b>视频 ${i ? 'B' : 'A'}</b>
          <small class="state" id="st${i}">尚未播放</small>
        </div>
        <video id="v${i}" controls controlslist="nodownload" playsinline preload="metadata" src="${media[i]}"></video>
        <p class="error" id="err${i}"></p>
        <button class="retry" id="retry${i}" hidden>重新加载视频</button>
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
    <button id="next" disabled>${isLast ? '检查并提交' : '下一组'}</button>
  </div>

  <dialog id="exitDlg">
    <h2>保存并稍后继续</h2>
    <p>当前已完成的作答将保存。你可以稍后使用同一浏览器继续，尚未提交的当前这一组不会计入正式结果。</p>
    <div class="row">
      <button class="secondary" id="exitCancel">继续作答</button>
      <button id="exitConfirm">保存并退出</button>
    </div>
  </dialog>

  <dialog id="confirmDlg">
    <h2>${isPractice ? '练习已完成' : '确认提交'}</h2>
    <p>${isPractice
      ? `下面开始正式匿名比较。正式部分共 ${TOTAL_FORMAL} 组视频比较，另含 ${TOTAL_ATTENTION} 个质量检查。`
      : '所有比较均已完成。提交后本轮评价即结束，无法再次修改。'}</p>
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
    if (isPractice || isLast) $('#confirmDlg').showModal();
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

    /* 加载失败：可重试，不清空已作答的四项（session.draft 独立保存） */
    const retry = $('#retry' + i);
    const reload = () => {
      $('#err' + i).textContent = '';
      retry.hidden = true;
      videos[i] = Object.assign(newVideoState(), { plays: videos[i].plays });
      st.textContent = '尚未播放';
      st.dataset.state = 'idle';
      v.src = media[i];
      v.load();
      update();
    };
    retry.onclick = reload;

    v.onplay = () => {
      const other = $('#v' + (1 - i));
      if (other && !other.paused) other.pause();   /* 播放互斥，避免语音重叠 */
      videos[i].plays += 1;
      videos[i].state = 'playing';
      if (!videos[i].startedAt) videos[i].startedAt = new Date().toISOString();
      videos[i].playFrom = Date.now();
      videos[i].lastTime = v.currentTime;
      st.textContent = '播放中';
      st.dataset.state = 'playing';
      update();
    };

    /* 只有真实播放（时间轴推进）才累计覆盖度：拖到末尾不计数 */
    v.ontimeupdate = () => {
      const d = v.currentTime - videos[i].lastTime;
      if (d > 0 && d < 1.5) videos[i].covered += d;
      videos[i].lastTime = v.currentTime;
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
      const dur = v.duration || 0;
      /* 覆盖度达到 92% 才认可“完整观看”（20 秒素材约 18.4 秒） */
      const okWatch = !dur || videos[i].covered >= dur * 0.92;
      if (okWatch) {
        videos[i].state = 'done';
        videos[i].completed = true;
        st.textContent = '已完整观看';
        st.dataset.state = 'done';
      } else {
        videos[i].state = 'partial';
        videos[i].completed = false;
        st.textContent = '未完整观看';
        st.dataset.state = 'idle';
        $('#err' + i).textContent = '这段视频没有被完整播放（可能被拖动过进度条）。请重新播放到结尾。';
      }
      update();
    };

    v.onerror = () => {
      stopClock();
      videos[i].state = 'error';
      videos[i].completed = false;
      videos[i].error = (v.error && v.error.code) || -1;
      st.textContent = '加载失败';
      st.dataset.state = 'idle';
      $('#err' + i).textContent = '视频加载失败。请点击下方按钮重试；若反复失败请联系研究者，并说明是视频 ' + (i ? 'B' : 'A') + '。';
      retry.hidden = false;
      update();
    };

    if (!media[i]) {
      $('#err' + i).textContent = '视频地址未配置。';
      retry.hidden = true;
    }
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

/* 门禁：两段视频都“已完整观看”，且四项都作答 */
function ready() {
  return videos.every(v => v.completed && v.state !== 'error')
    && [0, 1, 2, 3].every(i => Number.isInteger(session.draft[i]));
}

function update() {
  const next = $('#next');
  const hint = $('#hint');
  if (!next) return;
  const ok = ready();
  /* 两段视频未看完前，量表整体禁用；已开放后重播不会再次锁住 */
  const watched = videos.every(v => v.completed && v.state !== 'error');
  document.querySelectorAll('.scale input[type=radio]').forEach(r => { r.disabled = !watched; });
  if (ok && !answerEnabledAt) answerEnabledAt = new Date().toISOString();
  next.disabled = !ok;
  if (hint) hint.textContent = ok ? '本组已完成，可以继续' : '请完整播放两个视频并完成四项评价';
}

/* ---------------- 提交 ---------------- */

async function advance() {
  if (!ready()) return;

  const t = session.trials[session.index];
  const rt = Date.now() - enteredAt;

  const rating = {
    trial_id: t.trial_id,
    naturalness_score: session.draft[0],
    foot_score: session.draft[1],
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

  const isLast = session.index === TOTAL_TRIALS - 1;
  const btn = $('#next');
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '正在保存…'; }

  try {
    const ack = await API.submit(session.participant_id, [rating], isLast);
    if (isLast) session.ack = ack || {};
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = old; }
    alert('保存失败：' + (e.message || e) + '\n\n你的答案仍在页面上，请重试；若反复失败请联系研究者。');
    return;
  }

  session.answers.push(Object.assign({}, t, rating, { trial_order: session.index }));
  session.draft = {};
  session.index += 1;
  if (session.index === TOTAL_TRIALS) session.completed_at = new Date().toISOString();
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
    <p>${TOTAL_FORMAL} 组正式比较与 ${TOTAL_ATTENTION} 个质量检查已全部提交，你的评价已匿名记录至研究服务器。</p>
    <p>匿名参与编号：<span class="serial">${serial !== undefined && serial !== null ? '#' + serial : shortId}</span>
      <span class="muted">（${shortId}）</span></p>
    ${invalid ? '<p class="muted">本次记录中的质量检查未全部通过，可能不计入最终分析，但原始记录仍会保留。</p>' : ''}
    <p class="muted">你现在可以关闭此页面。如需补充说明，请联系研究者。</p>
  </section>`;
}
