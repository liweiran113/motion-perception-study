const $=s=>document.querySelector(s),KEY='trajpg-preview-v1';
const questions=['哪个角色更准确、连续地沿目标路径移动？','哪个角色的全身动作更协调自然，且支撑脚滑动、漂移或悬浮更少？','哪个角色的上肢手势、动作节奏与当前语音表达更匹配？','综合考虑路径、动作自然性、足部表现和语音匹配，你更偏好哪一个？'];
const labels=['视频 A 明显更好','视频 A 稍好','无明显差异','视频 B 稍好','视频 B 明显更好'];
let session;try{session=JSON.parse(localStorage.getItem(KEY))}catch{}
/* [占位媒体 · 仅此一处改动] 开发期默认加载占位视频，避免页面一进来就报"尚未配置视频"。
   正式接入匿名媒体 URL 时，把下面两行还原为：
   let media=['',''],played=[false,false],failed=[false,false],entered=Date.now(); */
const PLACEHOLDER='media/placeholder.mp4';
/* 后端开关：config.js 里 backend="supabase" 且填了 url/anonKey 时为 true */
const BACKEND_ON=function(){return !!(window.API&&window.API.enabled&&window.API.enabled());};
let media=[PLACEHOLDER,PLACEHOLDER],played=[false,false],failed=[false,false],entered=Date.now();
function save(){localStorage.setItem(KEY,JSON.stringify(session))}
function intro(){ $('#app').innerHTML=`<div class="intro"><section><div class="eyebrow">ANONYMOUS MOTION STUDY / 01</div><h1>看见动作的差异，<br>留下你的直观感受。</h1><p>无需专业知识。观看两段匿名视频，<br>告诉我们哪一个角色的表现更自然。</p><div class="stats"><div><strong>15–22 <small>分钟</small></strong><small>预计参与时间</small></div><div><strong>15 <small>组</small></strong><small>包含练习与比较</small></div><div><strong>4 <small>维</small></strong><small>独立评价维度</small></div></div><ol class="steps"><li><b>01</b>阅读说明，确认自愿参与</li><li><b>02</b>分别观看视频 A 与视频 B</li><li><b>03</b>按直观感受完成四项评价</li></ol>${BACKEND_ON()?'<div class="notice">正式采集模式：你的匿名评分会实时提交至研究服务器，不在本机保存副本。可随时关闭页面，进度已保存。</div>':'<div class="notice">前端预览模式：数据仅保存在此浏览器，不上传服务器。正式匿名视频与冻结清单尚未接入。</div>'}</section><section class="card"><div class="eyebrow">BEFORE YOU BEGIN</div><h2>研究说明与知情同意</h2><p>本研究用于比较不同方法生成的语音驱动全身动作。你将观看若干匿名视频对，并评价角色的路径遵循、动作自然性与足部稳定性、语音—手势匹配和整体表现。实验预计耗时约 15–22 分钟。参与完全自愿，在最终提交前可以随时退出。系统不收集姓名、手机号、邮箱或身份证等身份信息。匿名评分仅用于学术研究、汇总统计和论文报告。</p><form id="consent">${['我已年满 18 周岁。','我已阅读上述说明并自愿参加。','我同意匿名评分用于学术研究与论文汇总分析。','我当前可以正常播放视频和声音。'].map(t=>`<label class="check"><input type="checkbox" required><span>${t}</span></label>`).join('')}<label>你对三维动画、动作捕捉或计算机图形学的熟悉程度：<select required id="expertise"><option value="">请选择熟悉程度</option><option value="none">没有相关经验</option><option value="some">有少量了解或使用经验</option><option value="expert">有系统学习、研究或专业经验</option></select></label><button class="primary" disabled>开始评价 →</button></form></section></div>`;$('#consent').onchange=()=>$('.primary').disabled=!$('#consent').checkValidity();$('#consent').onsubmit=e=>{e.preventDefault();start()}}
function previewSession(){const id=crypto.randomUUID();let seed=Array.from(id).reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),0);const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};let trials=Array.from({length:12},(_,i)=>({trial_id:`preview-${i}`,trial_type:'formal',cell_index:i,candidate_index:(Math.floor(i/4)+i%4)%4,swap:i%2}));trials.push(...[0,1].map(i=>({trial_id:`attention-${i}`,trial_type:'attention'})));for(let i=trials.length-1;i>0;i--){let j=Math.floor(rand()*(i+1));[trials[i],trials[j]]=[trials[j],trials[i]]}session={participant_id:id,study_id:'frontend-pilot',expertise:$('#expertise').value,age_confirmed:true,consent_confirmed:true,research_consent_confirmed:true,audio_confirmed:true,started_at:new Date().toISOString(),index:0,trials:[{trial_id:'practice',trial_type:'practice'},...trials],answers:[],draft:{},backend:'preview'};save();render()}

/* 正式模式：分配由服务端冻结（serial、候选、A/B 交换都在库里算）。
   连接失败时停在同意页并明确报错，绝不静默降级到本地预览——否则数据会白采。 */
async function start(){
  const expertise=$('#expertise').value;
  if(BACKEND_ON()){
    const btn=document.querySelector('.primary');const old=btn.textContent;
    btn.disabled=true;btn.textContent='正在创建会话…';
    try{
      const r=await API.start({expertise:expertise,age:true,consent:true,audio:true});
      session={participant_id:r.participant_id,participant_serial:r.participant_serial,study_id:API.config.studyId,expertise:expertise,age_confirmed:true,consent_confirmed:true,research_consent_confirmed:true,audio_confirmed:true,started_at:new Date().toISOString(),index:0,trials:r.trials||[],answers:[],draft:{},backend:'supabase'};
      save();render();return;
    }catch(e){
      btn.disabled=false;btn.textContent=old;
      alert('无法连接研究服务器：'+e.message+'\n\n请检查网络后重试；若持续失败，请联系研究者。');
      return;
    }
  }
  previewSession();
}
function render(){if(!session)return intro();if(session.completed_at)return complete();played=[false,false];failed=[false,false];entered=Date.now();const t=session.trials[session.index];
/* 正式模式：视频地址由服务端下发（已完成 A/B 交换），前端不知道哪个是哪个方法 */
if(t.media_left_url||t.media_right_url){media=[t.media_left_url||'',t.media_right_url||'']}$('#app').innerHTML=`<div class="topline"><div><div class="eyebrow">MOTION COMPARISON</div><h2>${session.index===0?'练习试次，不计入正式统计':`正式试次 ${session.index} / 14`}</h2></div><button class="secondary" id="exit">暂时退出</button></div><div class="progress"><i style="width:${session.index/15*100}%"></i></div><div class="notice">${t.trial_type==='attention'?'这是注意力检查。请在下面四个问题中全部选择“无明显差异”。':'请分别播放 A 和 B，再独立回答四个问题。可以重复播放，选择没有正确或错误之分。'}</div><div class="videos" style="margin-top:22px">${[0,1].map(i=>`<section class="video-card"><div class="video-title"><b>视频 ${i?'B':'A'}</b><small id="status${i}">尚未播放</small></div><video id="v${i}" controls controlslist="nodownload" playsinline preload="metadata"></video><p class="error" id="err${i}">尚未配置视频，请在下方导入本地测试视频。</p></section>`).join('')}</div><div class="questions">${questions.map((q,i)=>`<section class="question"><h3><span class="muted">0${i+1} / </span>${q}</h3><div class="scale">${labels.map((l,j)=>`<label><input type="radio" name="q${i}" value="${j+1}" ${session.draft[i]===j+1?'checked':''}>${l}</label>`).join('')}</div></section>`).join('')}</div><div class="actions"><span class="muted" id="hint">请播放两个视频并完成全部评价</span><button id="next" disabled>${session.index===14?'检查并保存':'下一试次 →'}</button></div><details class="tools"><summary>预览设置 · 导入本地测试视频</summary><p>仅用于测试播放器；重复用于预览试次，不属于正式实验素材。刷新后请重新选择文件。</p>${[0,1].map(i=>`<label>视频 ${i?'B':'A'}<input id="file${i}" type="file" accept="video/*"></label>`).join('')}</details><dialog id="confirm"><h2>${session.index===0?'练习已完成':'确认保存本地记录'}</h2><p>${session.index===0?'下面开始正式匿名比较。':'所有试次均已完成。当前没有连接后端，确认后只会保存至此浏览器，你可以下载自己的预览记录。'}</p><button id="yes">${session.index===0?'开始正式比较':'确认保存'}</button> <button class="secondary" id="no">返回检查</button></dialog>`;
 [0,1].forEach(i=>{const v=$('#v'+i);if(media[i]){v.src=media[i];$('#err'+i).textContent=''}v.onplay=()=>{$('#v'+(1-i)).pause();played[i]=true;$('#status'+i).textContent='已开始播放';update()};v.onerror=()=>{failed[i]=true;played[i]=false;$('#err'+i).textContent='视频加载失败，请重新选择可播放的视频。';update()};$('#file'+i).onchange=e=>{if(!e.target.files[0])return;if(media[i])URL.revokeObjectURL(media[i]);media[i]=URL.createObjectURL(e.target.files[0]);v.src=media[i];failed[i]=false;played[i]=false;$('#status'+i).textContent='尚未播放';$('#err'+i).textContent='';update()}});document.querySelectorAll('input[type=radio]').forEach(r=>r.onchange=()=>{session.draft[Number(r.name.slice(1))]=Number(r.value);save();update()});$('#exit').onclick=()=>{save();intro()};$('#next').onclick=()=>{if(!ready())return;if(session.index===0||session.index===14)$('#confirm').showModal();else advance()};$('#yes').onclick=advance;$('#no').onclick=()=>$('#confirm').close();}
function ready(){return played.every(Boolean)&&!failed.some(Boolean)&&[0,1,2,3].every(i=>Number.isInteger(session.draft[i]))}function update(){$('#next').disabled=!ready();$('#hint').textContent=ready()?'已完成，可以继续':'请播放两个视频并完成全部评价'}
async function advance(){if(!ready())return;const t=session.trials[session.index];
const rating={trial_id:t.trial_id,path_score:session.draft[0],motion_score:session.draft[1],speech_score:session.draft[2],overall_score:session.draft[3],response_time_ms:Date.now()-entered,created_at:new Date().toISOString()};
const isLast=session.index===14;
/* 正式模式：每个试次答完立即写库（增量），最后一题定稿并计算有效性。
   写库失败就停住、不前进，避免"以为交了其实没交"。 */
if(session.backend==='supabase'){const btn=document.querySelector('#next');const old=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='正在保存…'}
  try{const ack=await API.submit(session.participant_id,[rating],isLast);if(isLast)session.ack=ack||{}}catch(e){
    if(btn){btn.disabled=false;btn.textContent=old}
    alert('提交失败：'+e.message+'\n\n你的答案仍在本机，请重试；若反复失败请联系研究者。');return}}
session.answers.push({...t,trial_order:session.index+1,...rating});session.draft={};session.index++;if(session.index===15)session.completed_at=new Date().toISOString();save();render();window.scrollTo(0,0)}
function complete(){$('#app').innerHTML=`<section class="card center"><div class="success">✓</div><div class="eyebrow">PREVIEW COMPLETED</div><h1>感谢你的认真评价。</h1><p>15 个试次已完成，${session.backend==='supabase'?'你的评分已匿名记录至研究服务器。':'预览记录已保存在此浏览器。'}</p><div class="notice">${session.backend==='supabase'?('评分已提交至研究服务器'+(session.ack&&session.ack.valid_participant===false?'（注意力检查未通过，本次记录可能不计入分析）':'')+'。'):'当前未连接后端，数据尚未提交到研究服务器。'}</div><p>匿名参与编号：<strong>${session.backend==='supabase'?('#'+session.participant_serial):session.participant_id.slice(0,8)}</strong></p><button id="download">${session.backend==='supabase'?'下载我的作答副本':'下载我的预览记录'}</button> <button id="reset" class="secondary">重新预览</button></section>`;$('#download').onclick=()=>{let u=URL.createObjectURL(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}));let a=document.createElement('a');a.href=u;a.download='preview-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};$('#reset').onclick=()=>{localStorage.removeItem(KEY);session=null;intro()}}
/* 正式模式下不沿用旧的本地预览会话，避免两种模式的数据混在一起 */
if(BACKEND_ON()){const p=document.querySelector('.privacy');if(p)p.textContent='◎ 匿名参与 · 数据提交至研究服务器';if(session&&session.backend!=='supabase'){localStorage.removeItem(KEY);session=null}}
if(session&&!session.completed_at){intro();const b=document.createElement('button');b.className='secondary';b.textContent=session.backend==='supabase'?'继续上次作答':'继续上次预览';b.onclick=render;$('.card').prepend(b)}else render();
