const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'public/assets/app.js'),'utf8');
const F=require('../public/assets/forecast.js');
const data=JSON.parse(fs.readFileSync(path.join(root,'public/data/season.json'),'utf8'));
new vm.Script(app,{filename:'app.js'});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'All HTML IDs should be unique');
for(const id of ['form-badges','form-summary','form-match-detail','stats-ppg','data-status-text','data-stamp',
  'target-rank','target-total','target-needed','target-plan','briefing-match','briefing-scenarios',
  'scout-opponent','scout-card','scout-form-badges','scout-match-detail','scout-form-summary','scout-results-coverage','share-predictions','share-url','share-tools','shared-mode-banner',
  'copy-share','restore-personal','save-shared']){
  assert(ids.includes(id),'Missing interactive UI element '+id);
}
for(const id of ['season-results-list','canford-results-mode','division-results-mode','recent-results']){
  assert(!ids.includes(id),'Obsolete results table remains: '+id);
}
const matches=data.results.filter(r=>r.home===data.team||r.away===data.team);
const own=data.standings.find(r=>r.name===data.team);
assert(own,'Canford United must appear in standings');
assert.equal(matches.length,own.played,'Canford result history must match games played');
assert(app.includes('function renderSeasonForm()'));
assert(app.includes('function renderScoutingCard()'));
assert(app.includes('function renderScoutingTimeline()'));
assert(app.includes('function renderScoutingMatchDetail()'));
assert(app.includes('data-scout-match-index'));
assert(app.includes('a.date.localeCompare(b.date)'));
assert(!app.includes('Opponent recent results, earliest to latest'));
assert(app.includes('function renderBriefing()'));
assert(app.includes('function renderPointsTarget()'));
assert(app.includes('function sharePredictions()'));
assert(app.includes('data-match-index'));
assert(app.includes('lastCheckStatus'));
assert(!app.includes('n.toFixed(1)'),'Projected points should not have decimals');

function dashboard(hash='',stored={}){
  const elements=new Map(),savedWrites=[],copies=[],errors=[];
  const el=id=>{
    assert(ids.includes(id),'Code references a missing DOM element: '+id);
    if(!elements.has(id)){
      const node={
        id,innerHTML:'',textContent:'',value:'',href:'',dataset:{},style:{},
        listeners:{},attrs:{},hidden:true,scrollLeft:0,scrollWidth:300,
        classList:{toggle(){},add(){},remove(){}},
        setAttribute(key,value){this.attrs[key]=value},
        addEventListener(kind,cb){this.listeners[kind]=cb},
        closest(){return {classList:{toggle(){}}}},
        scrollIntoView(){},focus(){},select(){}
      };
      if(id==='target-rank')node.value='6';
      elements.set(id,node);
    }
    return elements.get(id);
  };
  const document={
    getElementById:el,
    querySelectorAll(){return []},
    execCommand(){return false}
  };
  const origin='https://samstephenfields.github.io/canford-united-dashboard/';
  const window={
    CanfordForecast:F,
    location:{href:origin+hash,hash},
    history:{replaceState(_state,_title,url){
      window.location.href=url;
      window.location.hash=new URL(url).hash;
    }}
  };
  let storageValue=JSON.stringify(stored);
  const localStorage={
    getItem(){return storageValue},
    setItem(key,value){storageValue=value;savedWrites.push({key,value})}
  };
  const navigator={clipboard:{async writeText(value){copies.push(value)}}};
  const fetch=async()=>({ok:true,json:async()=>data});
  vm.runInNewContext(app,{window,document,localStorage,navigator,fetch,URL,Date,Intl,console:{
    log(){},error(error){errors.push(String(error))}
  }},{filename:'app.js'});
  return {el,window,savedWrites,copies,errors,local:()=>JSON.parse(storageValue)};
}
async function run(){
  const remaining=F.remainingFixtures(data);
  const example=remaining[0];
  const pick=example?{[example.id]:{homeScore:1,awayScore:0}}:{};
  const personal=dashboard('',pick);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(personal.errors,[]);
  assert.match(personal.el('forecast-points').textContent,/^\d+$/);
  assert.match(personal.el('mobile-projection-points').textContent,/^\d+ pts$/);
  assert.match(personal.el('target-total').textContent.toString(),/^\d+$/);
  assert.match(personal.el('target-needed').textContent.toString(),/^\d+$/);
  assert(personal.el('scout-card').innerHTML.length>80,'Scouting details should load');
  personal.el('scout-opponent').listeners.change({target:{value:'Westland Sports Reserves'}});
  const westlandChips=personal.el('scout-form-badges').innerHTML;
  assert.equal((westlandChips.match(/data-scout-match-index=/g)||[]).length,2,'Show both known Westland matches');
  assert.match(westlandChips,/17 Oct/);
  assert.match(westlandChips,/7 Nov/);
  assert.match(personal.el('scout-match-detail').innerHTML,/7 November/,'Latest opponent match selected by default');
  personal.el('scout-form-badges').listeners.click({
    target:{closest:()=>({dataset:{scoutMatchIndex:'0'}})}
  });
  assert.match(personal.el('scout-match-detail').innerHTML,/17 October/,'Clicking earlier W chip shows selected game');
  assert.match(personal.el('scout-match-detail').innerHTML,/1 <span>–<\/span> 4/,'Show correct home/away score');
  personal.el('scout-opponent').listeners.change({target:{value:'Stars FC'}});
  assert.equal((personal.el('scout-form-badges').innerHTML.match(/data-scout-match-index=/g)||[]).length,1);
  assert.match(personal.el('scout-results-coverage').textContent,/Partial record: 1 of 8/);
  assert.match(personal.el('scout-match-detail').innerHTML,/12 September/);

  assert(personal.el('briefing-match').innerHTML.length>50,'Next-match briefing should load');
  if(remaining.length){
    assert(personal.el('scout-opponent').innerHTML.includes('option'));
  }
  personal.el('share-predictions').listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(personal.el('share-tools').hidden,false);
  const sharedURL=personal.el('share-url').value;
  assert(sharedURL.includes('#p='));
  assert.equal(personal.copies.at(-1),sharedURL);
  const shared=dashboard(new URL(sharedURL).hash,{});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(shared.errors,[]);
  assert.equal(shared.el('shared-mode-banner').hidden,false);
  assert.match(shared.el('forecast-points').textContent,/^\d+$/);
  assert.equal(shared.savedWrites.length,0,'Opening another forecast must not overwrite own picks');
  shared.el('restore-personal').listeners.click();
  assert.equal(shared.el('shared-mode-banner').hidden,true);
  assert.equal(shared.el('forecast-selected').textContent.split(' ')[0],'0');
  const sharedAgain=dashboard(new URL(sharedURL).hash,{});
  await new Promise(resolve=>setImmediate(resolve));
  sharedAgain.el('save-shared').listeners.click();
  assert.equal(sharedAgain.el('shared-mode-banner').hidden,true);
  assert(sharedAgain.savedWrites.length>=1,'Explicitly saving should write shared picks to browser');
  console.log('Mobile forecast, targets, scouting, match briefing and share-link checks passed');
}
run().catch(error=>{console.error(error);process.exitCode=1});
