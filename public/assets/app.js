(function(){
 'use strict';
 const F=window.CanfordForecast;
 const STATE={data:null,picks:{},mode:'actual',formIndex:null,sharedMode:false,scoutOpponent:null};
 const STORAGE='canford-predictions:2026-27:v1';
 const $=id=>document.getElementById(id);
 const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isFinite(n)?String(Math.round(n)):'—';
 const shortDate=date=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):'TBC';
 const nameTeam=s=>s==='Bournemouth Poppies Reserves'?'Bournemouth Poppies Res.':s;
 const selfResult=(r,team)=>{const gf=r.home===team?r.homeScore:r.awayScore,ga=r.home===team?r.awayScore:r.homeScore;return{type:gf>ga?'W':gf===ga?'D':'L',gf,ga,opponent:F.opponent(r,team),date:r.date}};
 const saved=()=>{try{const obj=JSON.parse(localStorage.getItem(STORAGE)||'{}');return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{}}catch{return {}}};
 const persist=()=>{if(STATE.sharedMode)return;try{localStorage.setItem(STORAGE,JSON.stringify(STATE.picks))}catch{}};
 function currentPosition(data){const ordered=[...data.standings].sort((a,b)=>b.points-a.points||b.gd-a.gd);return ordered.findIndex(t=>t.name===data.team)+1;}
 function ukDate(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=type=>parts.find(p=>p.type===type)?.value;
  return get('year')+'-'+get('month')+'-'+get('day');
 }
 const rankText=n=>n+F.ordinal(n).toLowerCase();
 function nextScheduledFixture(){
  const remaining=new Set(F.remainingFixtures(STATE.data).map(f=>f.id));
  return (STATE.data.scheduledFixtures||[])
   .filter(f=>f.date&&f.date>=ukDate()&&remaining.has(F.key(f.home,f.away)))
   .sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''))[0]||null;
 }
 function teamRank(name){
  const rows=[...STATE.data.standings].sort((a,b)=>b.points-a.points||b.gd-a.gd||a.name.localeCompare(b.name));
  return rows.findIndex(r=>r.name===name)+1;
 }
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
      <div class="fixture-meta"><div class="fixture-opponent">${esc(nameTeam(f.opponent))} ${match?`<span class="fixture-result-pill ${match.result}">${match.result}</span>`:''}</div><div class="fixture-info"><span class="venue-pill ${home?'':'away'}">${home?'HOME':'AWAY'}</span>${f.date?`${esc(f.time||'Time TBC')} · ${esc(f.venue||'Venue TBC')}`:'Fixture date not yet published'}</div><button type="button" class="scout-link" data-scout="${esc(f.opponent)}">Scout opponent →</button></div>
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
   renderPointsTarget();
   renderBriefing();
   if(STATE.mode==='projected')renderTable();
 }

 function renderPointsTarget(){
  const desired=Number($('target-rank').value)||6;
  const t=F.pointsTarget(STATE.data,STATE.picks,desired);
  text('target-total',t.targetPoints);
  text('target-needed',t.need);
  const box=$('target-plan');
  box.classList.toggle('unreachable',!t.feasible);
  if(!t.feasible){
   box.innerHTML='<strong>Not achievable with these predicted scores.</strong> Maximum: '+t.maxPoints+
    ' points. Adjust your predictions to keep this target in reach.';
  }else if(t.need===0){
   box.innerHTML='<strong>Target already reached by recorded and selected results.</strong> '+
    'The estimate can still change as other clubs play.';
  }else if(t.plan){
   box.innerHTML='<strong>One possible route:</strong> '+t.plan.wins+' wins, '+t.plan.draws+
    ' draws and '+t.plan.losses+' losses from the '+t.open+' fixtures without a predicted score.'+
    '<div class="target-context">Requires '+t.need+' more points after the results you have selected.</div>';
  }else{
   box.textContent='No combination available with the remaining matches.';
  }
 }
 function scoreScenario(fixture,kind){
  const home=fixture.home===STATE.data.team;
  if(kind==='draw')return {homeScore:0,awayScore:0};
  const canfordWins=kind==='win';
  return {homeScore:(home===canfordWins)?1:0,awayScore:(home===canfordWins)?0:1};
 }
 function renderBriefing(){
  const next=nextScheduledFixture();
  if(!next){
   $('briefing-match').innerHTML='<div class="briefing-status">DATE TO BE CONFIRMED</div>'+
    '<div class="briefing-opponent">No upcoming fixture date in the saved snapshot</div>'+
    '<div class="briefing-info">There may be unplayed matches without published dates. '+
    '<a href="'+esc(STATE.data.officialTeamUrl)+'" target="_blank" rel="noopener noreferrer">Check official fixtures ↗</a></div>';
   $('briefing-scenarios').innerHTML='';
   return;
  }
  const opponent=F.opponent(next,STATE.data.team),home=next.home===STATE.data.team;
  const when=new Date(next.date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
  const venue=next.venue&&next.venue!=='Venue TBC'?next.venue:'Venue to be confirmed';
  $('briefing-match').innerHTML='<div class="briefing-status">'+(home?'HOME':'AWAY')+' · NEXT CONFIRMED FIXTURE</div>'+
   '<div class="briefing-opponent">'+esc(opponent)+'</div>'+
   '<div class="briefing-info">'+esc(when)+' · '+esc(next.time||'Kick-off TBC')+' · '+esc(venue)+'</div>'+
   '<div class="briefing-info">Opposition currently '+rankText(teamRank(opponent))+' in the league · '+
   '<a href="#scouting" id="briefing-scout-link">View scouting details ↗</a></div>';
  const id=F.key(next.home,next.away);
  $('briefing-scenarios').innerHTML=[['win','Win'],['draw','Draw'],['loss','Lose']].map(([code,label])=>{
   const projected=F.forecast(STATE.data,{...STATE.picks,[id]:scoreScenario(next,code)});
   return '<div class="briefing-case case-'+code+'"><span class="case-label">IF WE '+label.toUpperCase()+
     '</span><strong class="case-rank">'+rankText(projected.position)+'</strong><span class="case-points">'+
     fmt(projected.points)+' est. pts</span></div>';
  }).join('');
 }
 function renderScoutingSelector(){
  const remaining=F.remainingFixtures(STATE.data);
  const names=[...new Set(remaining.map(f=>f.opponent))].sort((a,b)=>a.localeCompare(b));
  const next=nextScheduledFixture();
  if(!STATE.scoutOpponent||!names.includes(STATE.scoutOpponent)){
   STATE.scoutOpponent=next?F.opponent(next,STATE.data.team):(names[0]||null);
  }
  $('scout-opponent').innerHTML=names.length?names.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('')
   :'<option value="">No remaining opponents</option>';
  $('scout-opponent').value=STATE.scoutOpponent||'';
  renderScoutingCard();
 }
 function renderScoutingCard(){
  const name=STATE.scoutOpponent,data=STATE.data;
  const card=$('scout-card');
  if(!name){card.innerHTML='<p class="form-empty">No remaining league opponents.</p>';return;}
  const row=data.standings.find(t=>t.name===name);
  if(!row){card.innerHTML='<p class="form-empty">No verified standings for this opponent.</p>';return;}
  const rank=teamRank(name),ppg=(row.points/Math.max(1,row.played)).toFixed(2);
  const headToHead=data.results.filter(r=>[r.home,r.away].includes(data.team)&&[r.home,r.away].includes(name))
   .sort((a,b)=>b.date.localeCompare(a.date));
  const recentHead=headToHead[0];
  const prev=recentHead?selfResult(recentHead,data.team):null;
  const past=recentHead?esc(shortDate(recentHead.date))+' · '+esc(prev.gf+'–'+prev.ga)+' '+prev.type+
   ' for Canford ('+(recentHead.home===data.team?'home':'away')+')'
   :'No recorded meeting between the clubs this season.';
  const recorded=data.results.filter(r=>r.home===name||r.away===name).sort((a,b)=>a.date.localeCompare(b.date));
  const coverage=recorded.length===row.played;
  const form=coverage&&recorded.length?recorded.slice(-5).map(r=>{
   const goals=r.home===name?r.homeScore:r.awayScore,conceded=r.home===name?r.awayScore:r.homeScore;
   return goals>conceded?'W':goals===conceded?'D':'L';
  }):[];
  const formHtml=form.length?
    '<div class="form-inline" aria-label="Opponent recent results, earliest to latest">'+form.map(v=>'<span class="'+v+'">'+v+'</span>').join('')+'</div>':
    '<p>Recent form unavailable: only '+recorded.length+' of '+row.played+' league results are recorded in this snapshot.</p>';
  const gf=Number.isFinite(row.gf)?row.gf:'—',ga=Number.isFinite(row.ga)?row.ga:'—';
  const fixtures=F.remainingFixtures(data).filter(f=>f.opponent===name);
  const nextFixture=fixtures.find(f=>f.date);
  const nextText=nextFixture?shortDate(nextFixture.date)+' · '+(nextFixture.home===data.team?'Home':'Away'):
    'Remaining fixture date TBC';
  card.innerHTML='<div class="scout-card-head"><div><h3 class="scout-card-title">'+esc(name)+'</h3>'+
    '<div class="scout-card-meta">'+row.won+'W · '+row.drawn+'D · '+row.lost+'L · '+row.played+
    ' played · Next meeting: '+esc(nextText)+'</div></div>'+
    '<div class="scout-position"><strong>'+rankText(rank)+'</strong><span>Current place</span></div></div>'+
    '<div class="scout-metrics">'+
    [['Points',row.points],['Points / game',ppg],['Goals scored',gf],['Goals conceded',ga]].map(([label,value])=>
     '<div class="scout-metric"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+
    '</div><div class="scout-insights"><div class="scout-insight"><strong>RECENT FORM</strong>'+formHtml+
    '</div><div class="scout-insight"><strong>PREVIOUS CANFORD MEETING</strong><p>'+past+'</p></div></div>'+
    '<p class="scout-footnote">Figures come from the latest saved league snapshot. A dash means the goals total could not be verified.</p>';
 }
 function openScout(name){
  STATE.scoutOpponent=name;
  $('scout-opponent').value=name;
  renderScoutingCard();
  $('scouting').scrollIntoView({behavior:'smooth',block:'start'});
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
  const next=nextScheduledFixture();
  text('hero-next-fixture',next?shortDate(next.date)+' · '+F.opponent(next,data.team)+' ('+(next.home===data.team?'Home':'Away')+')':'Check the fixture list for confirmed dates');
  text('stats-ppg',((cur.won*3+cur.drawn)/cur.played).toFixed(2));
  text('stats-gf',cur.gf!=null?(cur.gf/cur.played).toFixed(2):'—');text('stats-ga',cur.ga!=null?(cur.ga/cur.played).toFixed(2):'—');
  text('stats-gd',(cur.gd>0?'+':'')+cur.gd);
  renderSeasonForm();
  const officialTeam=$('official-fixtures'),officialTable=$('official-table');
  officialTeam.href=data.officialTeamUrl;officialTable.href=data.officialTableUrl;
  const lastCheck=data.lastCheckedAt?new Date(data.lastCheckedAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}):null;
  text('data-stamp',(lastCheck?'Checked '+lastCheck+' UK · ':'')+'Results through '+shortDate(data.dataAsOf));
  const checkedOk=data.lastCheckStatus==='ok';
  text('data-status-text',data.lastCheckStatus==='failed'?'Latest automatic check failed — showing last verified results':checkedOk?'Source checked — latest verified snapshot':'Starter results — automatic refresh not yet verified');
  $('data-light').classList.toggle('online',checkedOk);
 }


 function ownLeagueResults(){
  return STATE.data.results
   .filter(r=>r.home===STATE.data.team||r.away===STATE.data.team)
   .slice().sort((a,b)=>a.date.localeCompare(b.date)||a.home.localeCompare(b.home));
 }
 function renderSelectedResult(){
  const results=ownLeagueResults(),team=STATE.data.team;
  if(!results.length){
   $('form-match-detail').innerHTML='<p class="form-empty">No completed league matches have been recorded yet.</p>';
   return;
  }
  const index=STATE.formIndex==null?results.length-1:Math.min(Math.max(STATE.formIndex,0),results.length-1);
  STATE.formIndex=index;
  document.querySelectorAll('#form-badges .form-badge').forEach(button=>{
   const selected=Number(button.dataset.matchIndex)===index;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
  const r=results[index];
  const result=selfResult(r,team);
  const resultName=result.type==='W'?'Win':result.type==='D'?'Draw':'Loss';
  const date=new Date(r.date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const venue=r.home===team?'Home':'Away';
  $('form-match-detail').innerHTML='<div class="form-detail-heading">'+
   '<span class="form-detail-label">MATCH '+(index+1)+' OF '+results.length+'</span>'+
   '<span class="form-detail-outcome '+result.type+'">'+resultName+'</span>'+
   '</div><div class="form-detail-score">'+
   '<span class="form-detail-club '+(r.home===team?'canford':'')+'">'+esc(r.home)+'</span>'+
   '<strong>'+r.homeScore+' <span>–</span> '+r.awayScore+'</strong>'+
   '<span class="form-detail-club '+(r.away===team?'canford':'')+'">'+esc(r.away)+'</span>'+
   '</div><div class="form-detail-meta">'+esc(date)+' · '+venue+' for Canford · League match</div>';
 }
 function renderSeasonForm(){
  const results=ownLeagueResults(),team=STATE.data.team;
  const outcomes=results.map(r=>selfResult(r,team));
  const wins=outcomes.filter(r=>r.type==='W').length, draws=outcomes.filter(r=>r.type==='D').length;
  text('form-summary',wins+'W · '+draws+'D · '+(results.length-wins-draws)+'L · '+results.length+' played');
  $('form-badges').innerHTML=results.length?outcomes.map((r,index)=>{
   const fixture=results[index];
   const label=r.type==='W'?'Win':r.type==='D'?'Draw':'Loss';
   return '<div class="form-match">'+
    '<button type="button" class="form-badge '+r.type+'" data-match-index="'+index+'" aria-pressed="false"'+
    ' aria-label="Match '+(index+1)+' of '+results.length+': '+esc(label)+' versus '+esc(r.opponent)+', '+esc(shortDate(fixture.date))+'">'+r.type+'</button>'+
    '<span class="form-match-date">'+esc(shortDate(fixture.date))+'</span></div>';
  }).join(''):'<span class="form-empty">No results yet</span>';
  if(STATE.formIndex===null||STATE.formIndex>=results.length)STATE.formIndex=Math.max(0,results.length-1);
  renderSelectedResult();
  // Put the newest result in view on narrow screens; older games remain swipeable.
  const rail=$('form-badges');rail.scrollLeft=rail.scrollWidth;
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
  $('target-rank').addEventListener('change',renderPointsTarget);
  $('scout-opponent').addEventListener('change',ev=>{STATE.scoutOpponent=ev.target.value;renderScoutingCard()});
  $('fixtures-list').addEventListener('click',ev=>{const b=ev.target.closest('button[data-scout]');if(b)openScout(b.dataset.scout)});
  $('briefing-match').addEventListener('click',ev=>{if(ev.target.closest('#briefing-scout-link')){const next=nextScheduledFixture();if(next)openScout(F.opponent(next,STATE.data.team));}});
  $('share-predictions').addEventListener('click',sharePredictions);
  $('copy-share').addEventListener('click',copyShareUrl);
  $('restore-personal').addEventListener('click',restorePersonal);
  $('save-shared').addEventListener('click',saveShared);
  $('actual-mode').addEventListener('click',()=>{STATE.mode='actual';renderTable()});
  $('projected-mode').addEventListener('click',()=>{STATE.mode='projected';renderTable()});
  $('form-badges').addEventListener('click',ev=>{
   const button=ev.target.closest('button[data-match-index]');
   if(!button)return;
   STATE.formIndex=Number(button.dataset.matchIndex);
   renderSelectedResult();
  });
 }

 function shareAddress(){
  const url=new URL(window.location.href);
  url.hash='p='+encodeURIComponent(F.serializePredictions(STATE.data,STATE.picks));
  return url.href;
 }
 async function copyTextToClipboard(value){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(value);return true}catch{}
  }
  try{
    const field=$('share-url');field.focus();field.select();
    return Boolean(document.execCommand&&document.execCommand('copy'));
  }catch{return false;}
 }
 async function sharePredictions(){
  const share=shareAddress();
  $('share-tools').hidden=false;
  $('share-url').value=share;
  const ok=await copyTextToClipboard(share);
  text('share-status',ok?'Link copied. Send it to the captain, assistant manager or anyone you want to compare predictions with.':'Copy the link above to share these predictions. No login is required.');
 }
 async function copyShareUrl(){
  const url=$('share-url').value||shareAddress();
  $('share-tools').hidden=false;
  $('share-url').value=url;
  const ok=await copyTextToClipboard(url);
  text('share-status',ok?'Link copied to clipboard.':'Select and copy the link shown above.');
 }
 function clearSharedFragment(){
  const url=new URL(window.location.href);
  if(url.hash.startsWith('#p=')){
   url.hash='';
   if(window.history?.replaceState)window.history.replaceState(null,'',url.href);
  }
 }
 function updateSharedMode(){
  $('shared-mode-banner').hidden=!STATE.sharedMode;
 }
 function restorePersonal(){
  STATE.sharedMode=false;
  STATE.picks=saved();
  clearSharedFragment();
  updateSharedMode();
  $('share-tools').hidden=true;
  rerender();
 }
 function saveShared(){
  STATE.sharedMode=false;
  try{localStorage.setItem(STORAGE,JSON.stringify(STATE.picks))}catch{}
  clearSharedFragment();
  updateSharedMode();
  $('share-tools').hidden=true;
  rerender();
 }
 function loadSharedPredictions(data){
  const hash=window.location?.hash||'';
  if(!hash.startsWith('#p='))return null;
  try{return F.parseSharedPredictions(data,decodeURIComponent(hash.slice(3)))}
  catch{return null}
 }
 async function init(){
  handleInputs();
  try{
   const response=await fetch('data/season.json?ts='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   if(!data.standings||!data.standings.length||!data.results||!data.team)throw new Error('Incomplete data');
   STATE.data=data;
   const shared=loadSharedPredictions(data);
   STATE.sharedMode=shared!==null;
   STATE.picks=shared||saved();
   updateSharedMode();
   renderStats();renderScoutingSelector();rerender();
  }catch(err){
   text('data-status-text','Could not load data. Serve the site through GitHub Pages or a local web server.');
   text('data-stamp','');
   $('fixtures-list').innerHTML='<div class="loading-state">Season data is temporarily unavailable. Please try again later.</div>';
   console.error('Dashboard data error',err);
  }
 }
 init();
})();
