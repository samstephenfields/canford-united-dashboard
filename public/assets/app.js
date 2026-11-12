(function(){
 'use strict';
 const F=window.CanfordForecast;
 const STATE={data:null,formIndex:null,scoutOpponent:null,scoutMatchIndex:null};
 const $=id=>document.getElementById(id);
 const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isFinite(n)?String(Math.round(n)):'—';
 const shortDate=date=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):'TBC';
 const nameTeam=s=>s==='Bournemouth Poppies Reserves'?'Bournemouth Poppies Res.':s;
 const selfResult=(r,team)=>{const gf=r.home===team?r.homeScore:r.awayScore,ga=r.home===team?r.awayScore:r.homeScore;return{type:gf>ga?'W':gf===ga?'D':'L',gf,ga,opponent:F.opponent(r,team),date:r.date}};
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
 function provisionalNextResult(fixture,code){
  const team=STATE.data.team,opponent=F.opponent(fixture,team);
  const rows=STATE.data.standings.map(row=>({...row}));
  const us=rows.find(row=>row.name===team),them=rows.find(row=>row.name===opponent);
  if(!us||!them)return null;
  const difference=code==='win'?1:code==='loss'?-1:0;
  us.points+=code==='win'?3:code==='draw'?1:0;
  them.points+=code==='loss'?3:code==='draw'?1:0;
  us.gd+=difference;
  them.gd-=difference;
  rows.sort((a,b)=>b.points-a.points||b.gd-a.gd||a.name.localeCompare(b.name));
  return {position:rows.findIndex(r=>r.name===team)+1,points:us.points};
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
  $('briefing-scenarios').innerHTML=[['win','Win'],['draw','Draw'],['loss','Loss']].map(([code,label])=>{
   const r=provisionalNextResult(next,code);
   if(!r)return '';
   return '<div class="briefing-case case-'+code+'"><span class="case-label">'+label.toUpperCase()+
    '</span><strong class="case-rank">'+r.points+' pts</strong>'+
    '<span class="case-points">Provisional '+rankText(r.position)+'</span></div>';
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

 function opponentResults(name){
  return STATE.data.results
   .filter(r=>r.home===name||r.away===name)
   .slice().sort((a,b)=>a.date.localeCompare(b.date)||a.home.localeCompare(b.home));
 }
 function renderScoutingMatchDetail(){
  const name=STATE.scoutOpponent,results=opponentResults(name);
  const detail=$('scout-match-detail');
  if(!results.length){
   detail.innerHTML='<p class="form-empty">No completed league results are available for this opponent in the current snapshot.</p>';
   return;
  }
  const index=STATE.scoutMatchIndex==null?results.length-1:
   Math.min(Math.max(STATE.scoutMatchIndex,0),results.length-1);
  STATE.scoutMatchIndex=index;
  document.querySelectorAll('#scout-form-badges .form-badge').forEach(button=>{
   const selected=Number(button.dataset.scoutMatchIndex)===index;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
  const match=results[index];
  const goals=match.home===name?match.homeScore:match.awayScore;
  const against=match.home===name?match.awayScore:match.homeScore;
  const outcome=goals>against?'W':goals===against?'D':'L';
  const resultName=outcome==='W'?'Win':outcome==='D'?'Draw':'Loss';
  const venue=match.home===name?'Home':'Away';
  const date=new Date(match.date+'T12:00:00Z')
   .toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  detail.innerHTML='<div class="form-detail-heading">'+
   '<span class="form-detail-label">MATCH '+(index+1)+' OF '+results.length+' · '+esc(name)+'</span>'+
   '<span class="form-detail-outcome '+outcome+'">'+resultName+'</span>'+
   '</div><div class="form-detail-score">'+
   '<span class="form-detail-club '+(match.home===name?'canford':'')+'">'+esc(match.home)+'</span>'+
   '<strong>'+match.homeScore+' <span>–</span> '+match.awayScore+'</strong>'+
   '<span class="form-detail-club '+(match.away===name?'canford':'')+'">'+esc(match.away)+'</span>'+
   '</div><div class="form-detail-meta">'+esc(date)+' · '+venue+' for '+esc(name)+' · League match</div>';
 }
 function renderScoutingTimeline(){
  const name=STATE.scoutOpponent;
  const tableRow=STATE.data.standings.find(t=>t.name===name);
  const results=opponentResults(name);
  const played=tableRow?.played??0;
  const complete=results.length===played;
  const rail=$('scout-form-badges');
  const summary=results.reduce((tot,r)=>{
   const gf=r.home===name?r.homeScore:r.awayScore,ga=r.home===name?r.awayScore:r.homeScore;
   tot[gf>ga?'W':gf===ga?'D':'L']++;
   return tot;
  },{W:0,D:0,L:0});
  text('scout-form-summary',results.length+' results · '+summary.W+'W · '+summary.D+'D · '+summary.L+'L');
  rail.innerHTML=results.length?results.map((r,index)=>{
   const gf=r.home===name?r.homeScore:r.awayScore,ga=r.home===name?r.awayScore:r.homeScore;
   const type=gf>ga?'W':gf===ga?'D':'L',label=type==='W'?'Win':type==='D'?'Draw':'Loss';
   const opponent=F.opponent(r,name);
   return '<div class="form-match"><button type="button" class="form-badge '+type+
    '" data-scout-match-index="'+index+'" aria-pressed="false"'+
    ' aria-label="Match '+(index+1)+' of '+results.length+': '+esc(label)+
    ' against '+esc(opponent)+', '+esc(shortDate(r.date))+'">'+type+'</button>'+
    '<span class="form-match-date">'+esc(shortDate(r.date))+'</span></div>';
  }).join(''):'<span class="form-empty">No recorded matches yet</span>';
  text('scout-results-coverage',complete?
   'All '+played+' league results currently shown in the standings are available.':
   'Partial record: '+results.length+' of '+played+' completed league matches are available in this snapshot. Missing results are not shown.');
  if(STATE.scoutMatchIndex===null||STATE.scoutMatchIndex>=results.length){
   STATE.scoutMatchIndex=Math.max(0,results.length-1);
  }
  renderScoutingMatchDetail();
  rail.scrollLeft=rail.scrollWidth;
 }
 function renderScoutingCard(){
  const name=STATE.scoutOpponent,data=STATE.data;
  const card=$('scout-card');
  if(!name){
   card.innerHTML='<p class="form-empty">No remaining league opponents.</p>';
   $('scout-form-badges').innerHTML='';
   $('scout-match-detail').innerHTML='';
   text('scout-form-summary','No results');
   text('scout-results-coverage','');
   return;
  }
  const row=data.standings.find(t=>t.name===name);
  if(!row){
   card.innerHTML='<p class="form-empty">No verified standings for this opponent.</p>';
   return;
  }
  const rank=teamRank(name),ppg=(row.points/Math.max(1,row.played)).toFixed(2);
  const headToHead=data.results.filter(r=>[r.home,r.away].includes(data.team)&&[r.home,r.away].includes(name))
   .sort((a,b)=>b.date.localeCompare(a.date));
  const recentHead=headToHead[0];
  const prev=recentHead?selfResult(recentHead,data.team):null;
  const past=recentHead?esc(shortDate(recentHead.date))+' · '+esc(prev.gf+'–'+prev.ga)+' '+prev.type+
   ' for Canford ('+(recentHead.home===data.team?'home':'away')+')'
   :'No recorded meeting between the clubs this season.';
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
    '</div><div class="scout-insights scout-insights-single"><div class="scout-insight"><strong>PREVIOUS CANFORD MEETING</strong><p>'+past+'</p></div></div>';
  renderScoutingTimeline();
 }
 function openScout(name){
  STATE.scoutOpponent=name;
  STATE.scoutMatchIndex=null;
  $('scout-opponent').value=name;
  renderScoutingCard();
  $('scouting-details').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderTable(){
  const data=STATE.data;
  const rows=[...data.standings].sort((a,b)=>b.points-a.points||b.gd-a.gd||a.name.localeCompare(b.name));
  $('league-body').innerHTML=rows.map((r,i)=>{
   const isUs=r.name===data.team;
   const club=(isUs?'<span class="team-indicator"></span>':'')+esc(r.name);
   return '<tr class="'+(isUs?'our-team':'')+'"><td>'+(i+1)+'</td><td>'+club+'</td>'+
    '<td>'+r.played+'</td><td>'+r.won+'</td><td>'+r.drawn+'</td><td>'+r.lost+'</td>'+
    '<td>'+(r.gd>0?'+':'')+r.gd+'</td><td>'+r.points+'</td></tr>';
  }).join('');
  text('table-note','Recorded league standings as at '+shortDate(data.dataAsOf)+' · Official table linked above.');
 }
 function renderStats(){
  const data=STATE.data,cur=data.standings.find(t=>t.name===data.team),pos=currentPosition(data);
  text('current-position',pos);text('hero-points',cur.points);text('hero-played',cur.played);
  text('hero-left',(data.totalMatchesPerTeam-cur.played));
  text('season-progress-label',Math.round(100*cur.played/data.totalMatchesPerTeam)+'%');
  $('season-progress').style.width=(100*cur.played/data.totalMatchesPerTeam)+'%';
  const next=nextScheduledFixture();
  text('hero-next-fixture',next?shortDate(next.date)+' · '+F.opponent(next,data.team)+' ('+(next.home===data.team?'Home':'Away')+')':'Check the fixture list for confirmed dates');
  text('stats-ppg',((cur.won*3+cur.drawn)/cur.played).toFixed(2));
  text('stats-gf',cur.gf!=null?(cur.gf/cur.played).toFixed(2):'—');text('stats-ga',cur.ga!=null?(cur.ga/cur.played).toFixed(2):'—');
  text('stats-gd',(cur.gd>0?'+':'')+cur.gd);
  renderSeasonForm();
  const officialTeam=$('official-fixtures'),officialTable=$('official-table');
  officialTeam.href=data.officialTeamUrl;officialTable.href=data.officialTableUrl;
  const checkedOk=data.lastCheckStatus==='ok';
  const verifiedDate=shortDate(data.dataAsOf);
  const checkStatus=data.lastCheckStatus==='failed'?' · Auto-refresh unavailable':'';
  text('data-status-text','Results to '+verifiedDate+checkStatus);
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

 const SQUAD={data:null,sort:'goalContributions'};
 const SQUAD_SORTS=['goalContributions','appearances','goals','assists','preAssists','goalsConceded'];
 function renderSquad(){
  const players=Array.isArray(SQUAD.data?.players)?SQUAD.data.players:[];
  $('squad-sort').value=SQUAD.sort;
  const sorted=players.slice().sort((a,b)=>{
   const av=a[SQUAD.sort],bv=b[SQUAD.sort];
   if(av===null)return bv===null?a.name.localeCompare(b.name):1;
   if(bv===null)return -1;
   const primary=SQUAD.sort==='goalsConceded'?av-bv:bv-av;
   if(primary)return primary;
   const secondary=b.goalContributions-a.goalContributions;
   if(secondary)return secondary;
   return a.name.localeCompare(b.name);
  });
  $('squad-rows').innerHTML=sorted.length?sorted.map(p=>{
   const label='<span class="squad-player-name">'+esc(p.name)+'</span>'+
    '<span class="squad-player-position"> ('+esc(p.position)+')</span>'+
    (p.status==='Left'?'<span class="squad-left">Left</span>':'');
   const cell=key=>'<td class="'+(SQUAD.sort===key?'squad-active-metric':'')+'">'+p[key]+'</td>';
   const conceded=p.appearances>0?p.goalsConceded.toFixed(1):'—';
   const detail=p.appearances>0?p.goalsConcededTotal+' conceded / '+p.appearances+' squad appearances':'No squad appearances';
   const concededCell='<td class="squad-conceded '+(SQUAD.sort==='goalsConceded'?'squad-active-metric':'')+
    '" title="'+esc(detail)+'">'+conceded+'</td>';
   return '<tr><th scope="row" class="squad-player-cell">'+label+'</th>'+
    cell('appearances')+cell('goals')+cell('assists')+
    cell('preAssists')+cell('goalContributions')+concededCell+'</tr>';
  }).join(''):'<tr><td colspan="7">Player statistics are currently unavailable.</td></tr>';
  if(!SQUAD.data){
   text('squad-subtitle','Player statistics unavailable.');
   text('squad-status','Club-maintained season data could not be loaded.');
   return;
  }
  text('squad-subtitle',players.length+' players · club-recorded league statistics');
  const date=new Date(SQUAD.data.sourceUpdatedAt+'T12:00:00Z').toLocaleDateString('en-GB',
   {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  text('squad-status','Club records · '+date+' snapshot · includes former squad members');
 }
 async function loadSquad(){
  try{
   const response=await fetch('data/squad.json?ts='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('Squad data unavailable');
   const json=await response.json();
   const metrics=['appearances','goals','assists','preAssists','goalContributions'];
   if(!Array.isArray(json.players)||json.season!==STATE.data.season||json.schemaVersion!==2)
    throw new Error('Invalid squad data');
   if(json.players.some(p=>typeof p.name!=='string'||!p.name.trim()||
       metrics.some(k=>!Number.isInteger(p[k])||p[k]<0)||
       !['GK','DEF','MID','ATT'].includes(p.position)||
       !Number.isInteger(p.goalsConcededTotal)||p.goalsConcededTotal<0||
       (p.appearances===0?(p.goalsConceded!==null||p.goalsConcededTotal!==0):
        (typeof p.goalsConceded!=='number'||!Number.isFinite(p.goalsConceded)||
         p.goalsConceded<0||Math.abs(p.goalsConceded*p.appearances-p.goalsConcededTotal)>1e-6))||
       p.goalContributions!==p.goals+p.assists+p.preAssists||
       (p.status!=null&&p.status!=='Left')))throw new Error('Invalid player statistics');
   if(new Set(json.players.map(p=>p.name)).size!==json.players.length)
    throw new Error('Duplicate squad players');
   SQUAD.data=json;
  }catch(error){
   SQUAD.data=null;
   console.error('Squad data unavailable',error);
  }
  renderSquad();
 }
 function handleInputs(){
  $('scout-opponent').addEventListener('change',ev=>{
   STATE.scoutOpponent=ev.target.value;STATE.scoutMatchIndex=null;renderScoutingCard();
  });
  $('scout-form-badges').addEventListener('click',ev=>{
   const chip=ev.target.closest('button[data-scout-match-index]');
   if(!chip)return;
   STATE.scoutMatchIndex=Number(chip.dataset.scoutMatchIndex);
   renderScoutingMatchDetail();
  });
  $('briefing-match').addEventListener('click',ev=>{
   if(ev.target.closest('#briefing-scout-link')){
    const next=nextScheduledFixture();if(next)openScout(F.opponent(next,STATE.data.team));
   }
  });
  $('squad-sort').addEventListener('change',ev=>{
   if(!SQUAD_SORTS.includes(ev.target.value))return;
   SQUAD.sort=ev.target.value;renderSquad();
  });
  $('form-badges').addEventListener('click',ev=>{
   const button=ev.target.closest('button[data-match-index]');
   if(!button)return;
   STATE.formIndex=Number(button.dataset.matchIndex);
   renderSelectedResult();
  });
 }
 async function init(){
  handleInputs();
  try{
   const response=await fetch('data/season.json?ts='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   if(!data.standings||!data.standings.length||!data.results||!data.team)throw new Error('Incomplete data');
   STATE.data=data;
   renderStats();renderScoutingSelector();renderBriefing();renderTable();await loadSquad();
  }catch(err){
   text('data-status-text','Results unavailable');
   $('briefing-match').innerHTML='<div class="loading-state">Season data is temporarily unavailable. Please try again later.</div>';
   console.error('Dashboard data error',err);
  }
 }
 init();
})();
