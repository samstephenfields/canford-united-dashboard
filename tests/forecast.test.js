const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../public/assets/forecast.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data/season.json'),'utf8'));
const fixtures=F.remainingFixtures(data);
const own=data.standings.find(t=>t.name===data.team);
assert(own,'Canford must be in the saved table');
assert.equal(fixtures.length,data.totalMatchesPerTeam-own.played);
assert.equal(data.results.filter(r=>r.home===data.team||r.away===data.team).length,own.played);
const baseline=F.forecast(data);
assert.equal(baseline.totalFixtures,fixtures.length);
assert.equal(baseline.selected,0);
assert.equal(baseline.minPoints,own.points);
assert.equal(baseline.maxPoints,own.points+3*fixtures.length);
assert.equal(F.forecast(data,{},'best').points,own.points+3*fixtures.length);
assert.equal(F.forecast(data,{},'worst').points,own.points);
const allWins=Object.fromEntries(fixtures.map(f=>[f.id,{
  homeScore:f.home===data.team?2:0,awayScore:f.away===data.team?2:0
}]));
const forecastWins=F.forecast(data,allWins);
assert.equal(forecastWins.points,own.points+3*fixtures.length);
assert.equal(forecastWins.selected,fixtures.length);
assert.equal(forecastWins.selectedWins,fixtures.length);
assert(!F.validPick({homeScore:0}));
assert(F.validPick({homeScore:0,awayScore:0}));
for(const rank of [1,4,6,8,data.standings.length]){
  const target=F.pointsTarget(data,{},rank);
  assert.equal(target.rank,rank);
  assert(Number.isInteger(target.targetPoints));
  assert(target.targetPoints>=own.points);
  assert.equal(target.open,fixtures.length);
  assert.equal(target.maxPoints,own.points+3*fixtures.length);
  if(target.feasible){
    assert(target.plan);
    assert.equal(target.plan.wins+target.plan.draws+target.plan.losses,target.open);
    assert(3*target.plan.wins+target.plan.draws>=target.need);
  }else assert(target.need>3*target.open);
}
const targetWins=F.pointsTarget(data,allWins,6);
assert.equal(targetWins.open,0);
assert.equal(targetWins.need,0);
assert(targetWins.feasible);
const encoded=F.serializePredictions(data,allWins);
assert.deepEqual(F.parseSharedPredictions(data,encoded),allWins);
assert.deepEqual(F.parseSharedPredictions(data,F.serializePredictions(data,{})),{});
assert.equal(F.parseSharedPredictions(data,'invalid JSON'),null);
assert.equal(F.parseSharedPredictions({...data,season:'different season'},encoded),null);
assert.equal(F.parseSharedPredictions(data,JSON.stringify({v:1,season:data.season,scores:[['Non-existent||Opponent',1,0]]})),null);
assert.equal(F.parseSharedPredictions(data,JSON.stringify({v:1,season:data.season,scores:[['Non-existent||Opponent',-1,0]]})),null);
console.log('Dynamic forecast, points targets and share-link tests passed');
