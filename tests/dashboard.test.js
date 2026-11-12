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
// WhatsApp/Instagram-style previews must be available to non-JavaScript crawlers.
const canonical='https://samstephenfields.github.io/canford-united-dashboard/';
assert(html.includes('<meta property="og:title"'),'Missing Open Graph title');
assert(html.includes('<meta property="og:description"'),'Missing Open Graph description');
assert(html.includes('<meta property="og:url" content="'+canonical+'"'),'Canonical OG URL mismatch');
assert(html.includes('property="og:image" content="'+canonical+'assets/whatsapp-preview.png'),'Missing absolute share image URL');
assert(html.includes('property="og:image:width" content="1200"'));
assert(html.includes('property="og:image:height" content="630"'));
assert(html.includes('name="twitter:card" content="summary_large_image"'));
const social=fs.readFileSync(path.join(root,'public/assets/whatsapp-preview.png'));
assert(social.length>10000 && social.length<600000,'Social preview should be a reasonably small image');
assert.equal(social.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invalid PNG header');
assert.equal(social.readUInt32BE(16),1200,'OG image width must be 1200');
assert.equal(social.readUInt32BE(20),630,'OG image height must be 630');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'All HTML IDs should be unique');
for(const id of ['form-badges','form-summary','form-match-detail','stats-ppg','data-status-text',
  'target-rank','target-total','target-needed','target-plan','briefing-match','briefing-scenarios',
  'scout-opponent','scout-card','scout-form-badges','scout-match-detail','scout-form-summary','scout-results-coverage','share-predictions','share-url','share-tools','shared-mode-banner',
  'copy-share','restore-personal','save-shared','squad-rows','squad-sort','squad-status','squad-subtitle','squad-definitions']){
  assert(ids.includes(id),'Missing interactive UI element '+id);
}
assert(!html.includes('class="scenario-block"'),'Redundant What if panel should be removed');
assert(!html.includes('id="data-stamp"'),'Long last-checked timestamp should be removed');
assert(!app.includes("text('best-case'")&&!app.includes("text('worst-case'"),'Removed scenarios must not be rendered');
assert(html.includes('id="official-fixtures"'),'Official fixture link must remain');
for(const id of ['season-results-list','canford-results-mode','division-results-mode','recent-results']){
  assert(!ids.includes(id),'Obsolete results table remains: '+id);
}
const scoutSection=html.indexOf('<section class="section scouting-section" id="scouting"');
const summarySection=html.indexOf('<section class="section planning-section" aria-labelledby="picture-title"');
assert(scoutSection>=0 && summarySection>scoutSection,'Opposition scouting should be first after the hero');
assert(html.indexOf('01 / OPPOSITION SCOUTING')<html.indexOf('02 / MATCHDAY PLANNING'),
  'Section numbers should match the displayed order');
assert(!html.includes('class="stat-grid"'),'Redundant four-card summary strip should be removed');
assert(!app.includes("text('stat-points'"),'Removed statistic cards should not have JavaScript bindings');
assert(html.includes('id="briefing"')&&html.includes('id="targets"'),
  'Matchday briefing and points target calculator should remain');
assert(html.includes('href="https://www.nonleaguematters.co.uk/divisions/117/"'),
  'Footer should credit the NonLeagueMatters results source');
const footer=html.slice(html.indexOf('<footer'));
assert(footer.includes('NonLeagueMatters'),'NonLeagueMatters credit should appear in the footer');
const matches=data.results.filter(r=>r.home===data.team||r.away===data.team);
const own=data.standings.find(r=>r.name===data.team);
assert(own,'Canford United must appear in standings');
assert.equal(matches.length,own.played,'Canford result history must match games played');
if(data.manualVerifiedAt){
  assert.equal(data.results.length,data.standings.reduce((sum,r)=>sum+r.played,0)/2,
    'Manually verified snapshot must include all completed league fixtures');
  assert(html.includes('Official FA results'),'Scouting section should link to official FA results');
}
assert(app.includes('function renderSeasonForm()'));
assert(app.includes('function renderSquad()'));
assert(app.includes('function loadSquad()'));
assert(html.includes('06 / CANFORD SQUAD'));
assert(html.includes('id="squad-rows"'));
assert.equal(squad.season,data.season);
assert.equal(squad.schemaVersion,2,'Use club-maintained season totals rather than partial scorers');
assert(squad.complete,'All recorded club squad players must be represented');
assert.equal(squad.players.length,27,'Season Totals should contain the complete 27-player record');
assert.equal(squad.players.reduce((n,p)=>n+p.appearances,0),127);
assert.equal(squad.players.reduce((n,p)=>n+p.goals,0),20);
assert.equal(squad.players.reduce((n,p)=>n+p.assists,0),13);
assert.equal(squad.players.reduce((n,p)=>n+p.preAssists,0),14);
assert.equal(squad.players.reduce((n,p)=>n+p.goalContributions,0),47);
assert(squad.players.every(p=>p.goalContributions===p.goals+p.assists+p.preAssists));
assert.equal(squad.players.filter(p=>p.status==='Left').length,2);
assert(html.includes('squad-definitions'),'Statistics must have visible on-page definitions');
assert(!html.includes('FA player statistics'),'Do not link to old FA squad data or expose a private sheet');
assert(!html.includes('id="squad-source"'),'Avoid public links to private club workbook');

assert(app.includes('function renderScoutingCard()'));
assert(!app.includes('Figures come from the latest saved league snapshot'),
  'Redundant scouting disclaimer must not be rendered');
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
  const fetch=async(url)=>({ok:true,json:async()=>url.includes('squad.json')?squad:data});
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
  const squadMarkup=personal.el('squad-rows').innerHTML;
  assert.equal((squadMarkup.match(/<tr>/g)||[]).length,squad.players.length);
  assert.match(squadMarkup,/Dean Fields/);
  assert.match(squadMarkup,/Charlie Dibben/);
  assert.match(squadMarkup,/squad-left/,'Former players must retain historical totals');
  assert.match(personal.el('squad-status').textContent,/12 Nov 2026 snapshot/);
  assert(squadMarkup.indexOf('Dean Fields')<squadMarkup.indexOf('Cam Corbin'),
    'Default ordering should show highest goal contributions first');
  personal.el('squad-sort').listeners.change({target:{value:'appearances'}});
  assert.equal(personal.el('squad-sort').value,'appearances');
  assert(personal.el('squad-rows').innerHTML.indexOf('Ethan Colebrook')<
         personal.el('squad-rows').innerHTML.indexOf('Dean Fields'),
    'Appearances sort must rank 8 before 7');
  personal.el('squad-sort').listeners.change({target:{value:'goals'}});
  assert.equal(personal.el('squad-sort').value,'goals');
  personal.el('squad-sort').listeners.change({target:{value:'preAssists'}});
  assert.equal(personal.el('squad-sort').value,'preAssists');
  personal.el('squad-sort').listeners.change({target:{value:'goalContributions'}});
  assert.equal(personal.el('squad-sort').value,'goalContributions');

  const westland='Westland Sports Reserves';
  personal.el('scout-opponent').listeners.change({target:{value:westland}});
  const westlandMatches=data.results.filter(r=>r.home===westland||r.away===westland);
  const westlandChips=personal.el('scout-form-badges').innerHTML;
  assert.equal((westlandChips.match(/data-scout-match-index=/g)||[]).length,westlandMatches.length,
    'Show every recorded Westland league match');
  if(westlandMatches.length){
    const sorted=[...westlandMatches].sort((a,b)=>a.date.localeCompare(b.date));
    assert.match(personal.el('scout-match-detail').innerHTML,/MATCH/,'Newest recorded opponent match should load');
    if(sorted.length>1){
      personal.el('scout-form-badges').listeners.click({
        target:{closest:()=>({dataset:{scoutMatchIndex:'0'}})}
      });
      assert(personal.el('scout-match-detail').innerHTML.includes(sorted[0].home));
      assert(personal.el('scout-match-detail').innerHTML.includes(sorted[0].away));
      assert(personal.el('scout-match-detail').innerHTML.includes(String(sorted[0].homeScore)));
    }
  }
  const stars='Stars FC';
  personal.el('scout-opponent').listeners.change({target:{value:stars}});
  const starsResults=data.results.filter(r=>r.home===stars||r.away===stars).length;
  assert.equal((personal.el('scout-form-badges').innerHTML.match(/data-scout-match-index=/g)||[]).length,starsResults);
  const starsPlayed=data.standings.find(r=>r.name===stars).played;
  if(starsResults===starsPlayed){
    assert.match(personal.el('scout-results-coverage').textContent,/All \d+ league results/);
  }else{
    assert.match(personal.el('scout-results-coverage').textContent,/Partial record:/);
  }

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
