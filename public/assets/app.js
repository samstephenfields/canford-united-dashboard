(function(){
 'use strict';
 const F=window.CanfordForecast;
 const STATE={data:null,picks:{},mode:'actual'};
 const STORAGE='canford-predictions:2026-27:v1';
 const $=id=>document.getElementById(id);
 const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isFinite(n)?n.toFixed(1):'—';
 const shortDate=date=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):'TBC';
 const nameTeam=s=>s==='Bournemouth Poppies Reserves'?'Bournemouth Poppies Res.':s;
 const selfResult=(r,team)=>{const gf=r.home===team?r.homeScore:r.awayScore,ga=r.home===team?r.awayScore:r.homeScore;return{type:gf>ga?'W':gf===ga?'D':'L',gf,ga,opponent:F.opponent(r,team),date:r.date}};
 const saved=()=>{try{const obj=JSON.parse(localStorage.getItem(STORAGE)||'{}');return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{}}catch{return {}}};
 const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(STATE.picks))}catch{}};
 function currentPosition(data){const ordered=[...data.standings].sort((a,b)=>b.points-a.points||b.gd-a.gd);return ordered.findIndex(t=>t.name===data.team)+1;}
 function fixtureMarkup(f){
   const pick=STATE.picks[f.id]||{};
   const picked=F.validPick(pick);
   const match=picked?F.outcome(pick,f,STATE.data.team):null;
   const home=f.home===STATE.data.team;
   const parts=f.date?new Date(f.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}).split(' '):['TBC',''];
   const ourSide=home?'homeScore':'awayScore';
   const theirSide=home?'awayScore':'homeScore';
   return `<div class="fixture-row ${picked?'predicted':''}" data-key="${esc(f.id)}">
      <div class="fixture-date ${f.date?'':'tbc'}"><span class="day">${esc(parts[0])}</span>${f.date?`<span class="month">${esc(parts[1].toUpperCase())}</span>`:''}</div>
      <div class="fixture-meta"><div class="fixture-opponent">${esc(nameTeam(f.opponent))} ${match?`<span class="fixture-result-pill ${match.result}">${match.result}</span>`:''}</div><div class="fixture-info"><span class="venue-pill ${home?'':'away'}">${home?'HOME':'AWAY'}</span>${f.date?`${esc(f.time||'Time TBC')} · ${esc(f.venue||'Venue TBC')}`:'Fixture date not yet published'}</div></div>
      <div class="score-wrap">
        <div class="score-control" role="group" aria-label="Predict Canford versus ${esc(f.opponent)}">
          <label class="score-side"><span>CANFORD</span><input class="score-field" data-side="${ourSide}" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="–" aria-label="Canford United goals against ${esc(f.opponent)}" value="${pick[ourSide]??''}"></label>
          <span class="score-dash" aria-hidden="true">–</span>
          <label class="score-side"><span>OPPONENT</span><input class="score-field" data-side="${theirSide}" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="–" aria-label="${esc(f.opponent)} goals against Canford United" value="${pick[theirSide]??''}"></label>
          <button class="clear-score" type="button" aria-label="Clear prediction against ${esc(f.opponent)}" data-clear="true">Clear</button>
        </div>
      </div>
   </div>`;
 }
 function renderFixtures(){
  const list=F.remainingFixtures(STATE.data);
  text('fixture-count',`${list.length} MATCHES REMAINING`);
  $('fixtures-list').innerHTML=list.length?list.map(fixtureMarkup).join(''):'<div class="loading-state">No remaining league matches.</div>';
  text('stat-remaining-sub',`${list.filter(f=>f.date).length} scheduled · ${list.filter(f=>!f.date).length} TBC`);
 }
 function renderProjection(){
   const data=STATE.data,result=F.forecast(data,STATE.picks),best=F.forecast(data,STATE.picks,'best'),worst=F.forecast(data,STATE.picks,'worst');
   text('stat-projection',result.position);text('stat-suffix',F.ordinal(result.position));
   text('stat-projection-sub',result.selected?`${result.selected} score${result.selected===1?'':'s'} entered`:'Based on current form');
   text('forecast-rank',result.position);text('forecast-suffix',F.ordinal(result.position));
   text('forecast-desc',result.selected?'Based on your scores + form for unpicked fixtures':'If current form continues');
   text('forecast-points',fmt(result.points));
   text('mobile-projection-rank',result.position+F.ordinal(result.position).toLowerCase());
   text('mobile-projection-points',fmt(result.points)+' pts');
   text('mobile-projection-count',result.selected+'/'+result.totalFixtures+' picked');
   text('forecast-selected',`${result.selected} of ${result.totalFixtures} predicted`);
   text('forecast-wdl',`${result.selectedWins}W · ${result.selectedDraws}D · ${result.selectedLosses}L`);
   $('forecast-progress').style.width=(result.totalFixtures?100*result.selected/result.totalFixtures:100)+'%';
   text('best-case',`${best.position}${F.ordinal(best.position).toLowerCase()} · ${Math.round(best.points)} pts`);
   text('worst-case',`${worst.position}${F.ordinal(worst.position).toLowerCase()} · ${Math.round(worst.points)} pts`);
   if(STATE.mode==='projected')renderTable();
 }
 function renderTable(){
  const data=STATE.data,proj=F.forecast(data,STATE.picks);const isProjected=STATE.mode==='projected';
  const rows=isProjected?proj.table:[...data.standings].sort((a,b)=>b.points-a.points||b.gd-a.gd||a.name.localeCompare(b.name));
  $('league-head').closest('table').classList.toggle('projected-table',isProjected);
  $('actual-mode').classList.toggle('active',!isProjected);$('projected-mode').classList.toggle('active',isProjected);
  $('actual-mode').setAttribute('aria-pressed',String(!isProjected));$('projected-mode').setAttribute('aria-pressed',String(isProjected));
  $('league-head').innerHTML=isProjected?'<tr><th class="pos-col">#</th><th class="club-col">CLUB</th><th>PL</th><th>PROJECTED GD</th><th>EST. PTS</th></tr>':'<tr><th class="pos-col">#</th><th class="club-col">CLUB</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th></tr>';
  $('league-body').innerHTML=rows.map((r,i)=>{
    const isUs=r.name===data.team;
    const club=`${isUs?'<span class="team-indicator"></span>':''}${esc(r.name)}`;
    const cols=isProjected?`<td>${r.played}</td><td>${r.projGD>=0?'+':''}${Math.round(r.projGD)}</td><td class="projected-points">${fmt(r.projPoints)}</td>`:`<td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gd>0?'+':''}${r.gd}</td><td>${r.points}</td>`;
    return `<tr class="${isUs?'our-team':''}"><td>${i+1}</td><td>${club}</td>${cols}</tr>`;
  }).join('');
  text('table-note',isProjected?'Model only: estimates each club’s remaining matches at current form; chosen scores replace rivals’ expected points for those games. Goal differences are estimated.':'Official league standings as at '+data.dataAsOf+' · Current league table link above.');
 }
 function renderStats(){
  const data=STATE.data,cur=data.standings.find(t=>t.name===data.team),pos=currentPosition(data);
  text('current-position',pos);text('hero-points',cur.points);text('hero-played',cur.played);
  text('hero-left',(data.totalMatchesPerTeam-cur.played));
  text('season-progress-label',Math.round(100*cur.played/data.totalMatchesPerTeam)+'%');
  $('season-progress').style.width=(100*cur.played/data.totalMatchesPerTeam)+'%';
  text('stat-points',cur.points);text('stat-remaining',data.totalMatchesPerTeam-cur.played);
  text('stat-maximum',cur.points+3*(data.totalMatchesPerTeam-cur.played));
  text('stats-ppg',((cur.won*3+cur.drawn)/cur.played).toFixed(2));
  text('stats-gf',cur.gf!=null?(cur.gf/cur.played).toFixed(2):'—');text('stats-ga',cur.ga!=null?(cur.ga/cur.played).toFixed(2):'—');
  text('stats-gd',(cur.gd>0?'+':'')+cur.gd);
  const recent=data.results.filter(r=>r.home===data.team||r.away===data.team).sort((a,b)=>a.date.localeCompare(b.date)).slice(-5).reverse();
  const lastFive=recent.map(r=>selfResult(r,data.team));
  $('form-badges').innerHTML=[...lastFive].reverse().map(r=>`<span class="form-badge ${r.type}" title="${esc(r.opponent)}">${r.type}</span>`).join('');
  text('form-summary',lastFive.filter(r=>r.type==='W').length+' wins · '+lastFive.filter(r=>r.type==='D').length+' draws · '+lastFive.filter(r=>r.type==='L').length+' losses in the last '+lastFive.length+' league games');
  $('recent-results').innerHTML=lastFive.slice(0,3).map(r=>`<div class="recent-row"><span>${esc(shortDate(r.date))} · ${esc(r.opponent)}</span><strong>${r.gf}–${r.ga} ${r.type}</strong></div>`).join('');
  const officialTeam=$('official-fixtures'),officialTable=$('official-table');
  officialTeam.href=data.officialTeamUrl;officialTable.href=data.officialTableUrl;
  text('data-stamp',data.lastSuccessfulSync?`Synced ${new Date(data.lastSuccessfulSync).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`:`Results through ${shortDate(data.dataAsOf)}`);
  text('data-status-text',data.lastSuccessfulSync?'Automatic data snapshot':'Starter snapshot · auto-sync starts after GitHub deployment');
  $('data-light').classList.toggle('online',!!data.lastSuccessfulSync);
 }
 function rerender(){renderFixtures();renderProjection();renderTable();}
 function handleInputs(){
  const parent=$('fixtures-list');
  parent.addEventListener('input',ev=>{
   if(!ev.target.matches('input.score-field'))return;
   const row=ev.target.closest('.fixture-row'),k=row.dataset.key,side=ev.target.dataset.side;
   const value=ev.target.value.trim();
   const pick=STATE.picks[k]||{};
   if(value==='')delete pick[side];
   else if(/^\d+$/.test(value)&&Number(value)<=30)pick[side]=Number(value);
   else {ev.target.value=pick[side]??'';return;}
   if(pick.homeScore==null&&pick.awayScore==null)delete STATE.picks[k];else STATE.picks[k]=pick;
   persist();renderProjection();
   const result=F.validPick(pick)?F.outcome(pick,F.remainingFixtures(STATE.data).find(f=>f.id===k),STATE.data.team):null;
   row.classList.toggle('predicted',!!result);
   const existing=row.querySelector('.fixture-result-pill');
   if(existing)existing.remove();
   if(result)row.querySelector('.fixture-opponent').insertAdjacentHTML('beforeend',` <span class="fixture-result-pill ${result.result}">${result.result}</span>`);
  });
  parent.addEventListener('click',ev=>{
   if(!ev.target.matches('button[data-clear]'))return;
   delete STATE.picks[ev.target.closest('.fixture-row').dataset.key];persist();rerender();
  });
  $('reset-predictions').addEventListener('click',()=>{STATE.picks={};persist();rerender()});
  $('actual-mode').addEventListener('click',()=>{STATE.mode='actual';renderTable()});
  $('projected-mode').addEventListener('click',()=>{STATE.mode='projected';renderTable()});
 }
 async function init(){
  handleInputs();
  try{
   const response=await fetch('data/season.json?ts='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   if(!data.standings||!data.standings.length||!data.results||!data.team)throw new Error('Incomplete data');
   STATE.data=data;STATE.picks=saved();
   renderStats();rerender();
  }catch(err){
   text('data-status-text','Could not load data. Serve the site through GitHub Pages or a local web server.');
   text('data-stamp','');
   $('fixtures-list').innerHTML='<div class="loading-state">Season data is temporarily unavailable. Please try again later.</div>';
   console.error('Dashboard data error',err);
  }
 }
 init();
})();
