const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/assets/app.js'),'utf8');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'public/data/season.json'),'utf8'));
new vm.Script(js,{filename:'app.js'});
for(const id of ['season-results-list','canford-results-mode','division-results-mode','results-summary','results-coverage-note','data-status-text','data-stamp']){
  assert(html.includes('id="'+id+'"'),'Missing UI element '+id);
}
const canfordMatches=snapshot.results.filter(r=>r.home===snapshot.team||r.away===snapshot.team);
const canfordRow=snapshot.standings.find(r=>r.name===snapshot.team);
assert(canfordRow,'Canford United must appear in the league table');
assert.equal(canfordMatches.length,canfordRow.played,'Canford results must cover every played league fixture');
assert(js.includes('renderSeasonResults();'),'Result history must be rendered on data load');
assert(js.includes('lastCheckStatus'),'Source freshness information must be visible');
console.log('Dashboard result-history and freshness smoke tests passed');
