const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'public/assets/app.js'),'utf8');
const F=require('../public/assets/forecast.js');
const data=JSON.parse(fs.readFileSync(path.join(root,'public/data/season.json'),'utf8'));
const squad=JSON.parse(fs.readFileSync(path.join(root,'public/data/squad.json'),'utf8'));
new vm.Script(app,{filename:'app.js'});

const canonical='https://samstephenfields.github.io/canford-united-dashboard/';
assert(html.includes('<meta property="og:title"'));
assert(html.includes('<meta property="og:description"'));
assert(html.includes('<meta property="og:url" content="'+canonical+'"'));
assert(html.includes('property="og:image" content="'+canonical+'assets/whatsapp-preview.png'));
assert(html.includes('name="twitter:card" content="summary_large_image"'));
const previewBuilder=fs.readFileSync(path.join(root,'scripts/build_social_preview.py'),'utf8');
assert(previewBuilder.includes('Results. Form. The next match.'),
 'Share preview must describe the fact-led site');
assert(!previewBuilder.includes('Predict the run-in.'),
 'Share preview must not promote the removed predictor');
const social=fs.readFileSync(path.join(root,'public/assets/whatsapp-preview.png'));
assert(social.length>10000 && social.length<600000);
assert.equal(social.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(social.readUInt32BE(16),1200);
assert.equal(social.readUInt32BE(20),630);

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'HTML element IDs must be unique');
for(const id of [
 'current-position','hero-points','hero-played','hero-left','hero-next-fixture',
 'data-status-text','official-fixtures','official-table',
 'scouting','scouting-details','scout-opponent','scout-card','scout-form-badges','scout-form-summary',
 'scout-match-detail','scout-results-coverage','briefing','briefing-match',
 'briefing-scenarios','league-body','table-note','form','form-badges',
 'form-summary','form-match-detail','stats-ppg','stats-gf','stats-ga','stats-gd',
 'squad','squad-rows','squad-sort','squad-status','squad-subtitle','squad-definitions'
]) assert(ids.includes(id),'Missing factual dashboard element: '+id);
for(const id of ['targets','predictor','forecast','target-rank','forecast-points',
 'projected-mode','actual-mode','fixtures-list','share-predictions',
 'reset-predictions','mobile-projection-rank','shared-mode-banner']){
 assert(!ids.includes(id),'Removed feature still appears in HTML: '+id);
}
assert(!html.includes('Predict the remaining fixtures'));
assert(!html.includes('What would a target finish require?'));
assert(!html.includes('Projected finish'));
assert(html.includes('What does the next result change?'));
assert(html.includes('Next match &amp; opposition'));
assert.equal((html.match(/<section\b/g)||[]).length,5,'There should be one matchweek section, plus other sections');
assert(html.indexOf('id="briefing"')>html.indexOf('id="scouting"'));
assert(html.indexOf('id="scouting-details"')>html.indexOf('id="briefing"'));
assert(html.includes('This is not a season-end prediction.'));
assert(html.includes('Recorded league standings'));
const order=['01 / MATCHWEEK BRIEFING','02 / LEAGUE TABLE',
 '03 / SEASON FORM','04 / CANFORD SQUAD'];
let at=-1;
for(const section of order){
 const next=html.indexOf(section);
 assert(next>at,'Sections out of order: '+section);
 at=next;
}
assert(!app.includes('renderProjection()'));
assert(!app.includes('function renderPointsTarget()'));
assert(!app.includes('function sharePredictions()'));
assert(!app.includes('STATE.picks'));
assert(!app.includes('F.forecast('),'On-screen computations must not use season-end forecasts');
assert(app.includes('function provisionalNextResult('));
const footer=html.slice(html.indexOf('<footer'));
assert(footer.includes('NonLeagueMatters'));

const matches=data.results.filter(r=>r.home===data.team||r.away===data.team);
const own=data.standings.find(r=>r.name===data.team);
assert(own,'The standings must include Canford United');
assert.equal(matches.length,own.played,'Club results should match recorded games played');
if(data.manualVerifiedAt){
 assert.equal(data.results.length,data.standings.reduce((sum,r)=>sum+r.played,0)/2);
}
assert.equal(squad.season,data.season);
assert.equal(squad.schemaVersion,2);
assert(squad.complete);
assert(squad.players.length>0);
const names=squad.players.map(p=>p.name);
assert.equal(names.length,new Set(names).size);
for(const p of squad.players){
 assert.equal(typeof p.name,'string');
 assert(p.name.trim());
 for(const metric of ['appearances','goals','assists','preAssists','goalInvolvements']){
  assert(Number.isInteger(p[metric]) && p[metric]>=0,'Invalid '+metric+' for '+p.name);
 }
 assert.equal(p.goalInvolvements,p.goals+p.assists+p.preAssists);
 assert(Number.isInteger(p.goalsConcededTotal)&&p.goalsConcededTotal>=0);
 if(p.appearances===0){
  assert.equal(p.goalsConceded,null);
  assert.equal(p.goalsConcededTotal,0);
 }else{
  assert.equal(typeof p.goalsConceded,'number');
  assert(Math.abs(p.goalsConceded*p.appearances-p.goalsConcededTotal)<1e-6);
 }
 assert(p.status==null||p.status==='Left');
 assert(['GK','DEF','MID','ATT'].includes(p.position),'Missing squad position for '+p.name);
}
assert(html.includes('Apps</abbr>'));
assert(html.includes('Goals + assists + pre-assists.'));
assert(html.includes('Goals Conceded'));
assert(html.includes('A squad-level average, not individual defensive responsibility.'));
assert.equal(squad.players.find(p=>p.name==='Ethan Colebrook').goalsConcededTotal,17);
assert(Math.abs(squad.players.find(p=>p.name==='Ethan Colebrook').goalsConceded-2.125)<1e-9);
assert.equal(squad.players.find(p=>p.name==='Rob Coley').goalsConceded,null);
assert(!html.includes('id="squad-source"'),'Private workbook link must not be published');

function dashboard(){
 const elements=new Map(),errors=[];
 const el=id=>{
  assert(ids.includes(id),'JS refers to missing element '+id);
  if(!elements.has(id)){
   elements.set(id,{
    id,textContent:'',innerHTML:'',value:'',href:'',dataset:{},style:{},
    listeners:{},attrs:{},hidden:true,scrollLeft:0,scrollWidth:300,
    classList:{toggle(){},add(){},remove(){}},
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,fn){this.listeners[k]=fn;},
    closest(){return {classList:{toggle(){}}};},
    scrollIntoView(){},focus(){},select(){}
   });
  }
  return elements.get(id);
 };
 const document={getElementById:el,querySelectorAll(){return []},execCommand(){return false}};
 const window={CanfordForecast:F,location:{href:canonical,hash:''}};
 const fetch=async url=>({ok:true,json:async()=>url.includes('squad.json')?squad:data});
 const injected=app.replace(/\n init\(\);/, '\n window.__canfordTest={provisionalNextResult};\n init();');
 assert(injected.includes('window.__canfordTest'));
 vm.runInNewContext(injected,{document,window,fetch,Date,Intl,URL,console:{
  error(error){errors.push(String(error));},log(){}
 }},{filename:'app.js'});
 return {el,window,errors};
}

async function run(){
 const site=dashboard();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(site.errors,[]);
 assert(site.el('league-body').innerHTML.includes(data.team));
 assert.match(site.el('table-note').textContent,/Recorded league standings/);
 assert(site.el('squad-rows').innerHTML.includes(squad.players[0].name));
 assert(site.el('squad-rows').innerHTML.includes('Dean Fields'));
 assert(site.el('squad-rows').innerHTML.includes(' (ATT)'));
 assert(site.el('squad-rows').innerHTML.includes('squad-player-position'));
 assert(site.el('squad-rows').innerHTML.includes('17 conceded / 8 squad appearances'));
 assert(site.el('squad-rows').innerHTML.includes('2.1'));
 assert(site.el('squad-rows').innerHTML.includes('squad-conceded'));
 assert.equal((site.el('squad-rows').innerHTML.match(/<tr>/g)||[]).length,squad.players.length);
 assert.match(site.el('squad-subtitle').textContent,/club-recorded league statistics/);
 assert(site.el('form-badges').innerHTML.length>30);
 assert(site.el('scout-card').innerHTML.length>30);
 assert(site.el('briefing-match').innerHTML.length>30);
 assert(site.el('briefing-scenarios').innerHTML.length===0 ||
        (site.el('briefing-scenarios').innerHTML.match(/briefing-case/g)||[]).length===3);
 for(const metric of ['appearances','goals','assists','preAssists','goalInvolvements','goalsConceded']){
  site.el('squad-sort').listeners.change({target:{value:metric}});
  assert.equal(site.el('squad-sort').value,metric);
 }
 const scout='Westland Sports Reserves';
 site.el('scout-opponent').listeners.change({target:{value:scout}});
 assert(site.el('scout-card').innerHTML.includes('Westland'));
 const scoutChips=site.el('scout-form-badges').innerHTML;
 const matchCount=data.results.filter(r=>r.home===scout||r.away===scout).length;
 assert.equal((scoutChips.match(/data-scout-match-index=/g)||[]).length,matchCount);
 if(matchCount){
  site.el('scout-form-badges').listeners.click({
   target:{closest:()=>({dataset:{scoutMatchIndex:'0'}})}
  });
  assert(site.el('scout-match-detail').innerHTML.length>30);
 }
 const resultChips=site.el('form-badges').innerHTML;
 assert.equal((resultChips.match(/data-match-index=/g)||[]).length,matches.length);
 if(matches.length){
  site.el('form-badges').listeners.click({
   target:{closest:()=>({dataset:{matchIndex:'0'}})}
  });
  assert(site.el('form-match-detail').innerHTML.length>30);
 }
 const remaining=F.remainingFixtures(data);
 if(remaining.length){
  const fixture=remaining[0];
  const current=own.points;
  const calc=site.window.__canfordTest.provisionalNextResult;
  const win=calc(fixture,'win'),draw=calc(fixture,'draw'),loss=calc(fixture,'loss');
  assert.equal(win.points,current+3);
  assert.equal(draw.points,current+1);
  assert.equal(loss.points,current);
  for(const item of [win,draw,loss])
   assert(item.position>=1 && item.position<=data.standings.length);
 }
 console.log('Factual dashboard, matchweek comparison, scouting, league table, form and squad tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1});
