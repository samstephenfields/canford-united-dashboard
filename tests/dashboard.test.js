const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/assets/app.js'),'utf8');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'public/data/season.json'),'utf8'));
new vm.Script(js,{filename:'app.js'});
for(const id of ['form-badges','form-summary','form-match-detail','stats-ppg','stats-gf','stats-ga','stats-gd','data-status-text','data-stamp']){
  assert(html.includes('id="'+id+'"'),'Missing UI element '+id);
}
for(const id of ['season-results-list','canford-results-mode','division-results-mode','recent-results']){
  assert(!html.includes('id="'+id+'"'),'Obsolete results table remains: '+id);
}
const matches=snapshot.results.filter(r=>r.home===snapshot.team||r.away===snapshot.team);
const row=snapshot.standings.find(r=>r.name===snapshot.team);
assert(row,'Canford United must appear in the league table');
assert.equal(matches.length,row.played,'Canford history must cover every played league fixture');
assert(js.includes("function renderSeasonForm()"),'Season-wide form function missing');
assert(js.includes("function renderSelectedResult()"),'Match detail renderer missing');
assert(js.includes('data-match-index'),'Result chips should be individually clickable');
assert(js.includes("a.date.localeCompare(b.date)"),'Results should be chronological');
assert(js.includes('lastCheckStatus'),'Source freshness information must be visible');
console.log('Interactive season form, all-match coverage and freshness checks passed');
