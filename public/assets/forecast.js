/* Deterministic, dependency-free season projection engine. */
(function(root,factory){
  const out=factory();
  if(typeof module==='object' && module.exports) module.exports=out;
  if(root) root.CanfordForecast=out;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const key=(home,away)=>`${home}||${away}`;
  const opponent=(f,team)=>f.home===team?f.away:f.home;
  function remainingFixtures(data){
    const club=data.team;
    const names=data.standings.map(t=>t.name).filter(n=>n!==club);
    const finished=new Set((data.results||[]).filter(f=>f.home===club||f.away===club).map(f=>key(f.home,f.away)));
    const scheduled=new Map((data.scheduledFixtures||[]).filter(f=>f.home===club||f.away===club).map(f=>[key(f.home,f.away),f]));
    const list=[];
    for(const name of names){
      for(const [home,away] of [[club,name],[name,club]]){
        const k=key(home,away);
        if(finished.has(k))continue;
        const info=scheduled.get(k)||{};
        list.push({id:k,home,away,opponent:name,date:info.date||null,time:info.time||null,venue:info.venue||null,scheduled:!!info.date});
      }
    }
    return list.sort((a,b)=>{
      if(!!a.date!==!!b.date) return a.date?-1:1;
      if(a.date!==b.date) return (a.date||'').localeCompare(b.date||'');
      return a.opponent.localeCompare(b.opponent)||a.home.localeCompare(b.home);
    });
  }
  const isValidScore=n=>Number.isInteger(n)&&n>=0&&n<=30;
  function validPick(p){return p&&isValidScore(p.homeScore)&&isValidScore(p.awayScore)}
  function outcome(p,fixture,team){
    const us=fixture.home===team?p.homeScore:p.awayScore;
    const them=fixture.home===team?p.awayScore:p.homeScore;
    return {points:us>them?3:us===them?1:0,opponentPoints:us>them?0:us===them?1:3,gd:us-them,result:us>them?'W':us===them?'D':'L'};
  }
  function ordinal(n){return n===1?'ST':n===2?'ND':n===3?'RD':'TH'}
  function forecast(data,picks={},scenario='form'){
    const team=data.team,all=remainingFixtures(data);
    const table=data.standings;
    const ourselves=table.find(t=>t.name===team);
    if(!ourselves)throw new Error('Our team was not found in the table');
    const total=data.totalMatchesPerTeam||((table.length-1)*2);
    const ownFormRate=(3*ourselves.won+ourselves.drawn)/Math.max(1,ourselves.played);
    const ownGoalsRate=ourselves.gd/Math.max(1,ourselves.played);
    const rows=table.map(t=>{
      const rate=(3*t.won+t.drawn)/Math.max(1,t.played);
      return {...t,formRate:rate,projPoints:t.points+rate*Math.max(0,total-t.played),projGD:t.gd+(t.gd/Math.max(1,t.played))*Math.max(0,total-t.played)};
    });
    const byName=new Map(rows.map(t=>[t.name,t]));
    let selected=0,unspecified=0,selectedWins=0,selectedDraws=0,selectedLosses=0;
    let ownPoints=ourselves.points,ownGD=ourselves.gd;
    for(const f of all){
      const choice=picks[f.id];
      let out;
      if(validPick(choice)){
        selected++;
        out=outcome(choice,f,team);
        if(out.result==='W')selectedWins++;
        else if(out.result==='D')selectedDraws++;
        else selectedLosses++;
      }else{
        unspecified++;
        if(scenario==='best')out={points:3,opponentPoints:0,gd:1};
        if(scenario==='worst')out={points:0,opponentPoints:3,gd:-1};
      }
      if(out){
        ownPoints+=out.points;
        ownGD+=out.gd;
        const opp=byName.get(f.opponent);
        // A rival's form projection already includes this match. Replace its
        // average points/GD expectation with the selected outcome.
        if(opp){opp.projPoints+=out.opponentPoints-opp.formRate;opp.projGD+=(-out.gd)-(opp.gd/Math.max(1,opp.played));}
      }else{
        ownPoints+=ownFormRate;
        ownGD+=ownGoalsRate;
      }
    }
    const self=byName.get(team);
    self.projPoints=ownPoints;
    self.projGD=ownGD;
    rows.sort((a,b)=>b.projPoints-a.projPoints||b.projGD-a.projGD||a.name.localeCompare(b.name));
    return {position:rows.findIndex(r=>r.name===team)+1,points:ownPoints,table:rows,totalFixtures:all.length,selected,unspecified,selectedWins,selectedDraws,selectedLosses,minPoints:ourselves.points,maxPoints:ourselves.points+all.length*3};
  }

  // Target is the minimum integer points to finish ABOVE the projected
  // n-th rival. Equal points may hinge on goal difference, so it is not used.
  function pointsTarget(data,picks={},targetRank=6){
    const all=remainingFixtures(data);
    const rank=Math.min(Math.max(1,Math.trunc(Number(targetRank)||6)),data.standings.length);
    const projection=forecast(data,picks);
    const rivals=projection.table.filter(r=>r.name!==data.team).sort((a,b)=>b.projPoints-a.projPoints);
    const team=data.standings.find(r=>r.name===data.team);
    const estimatedThreshold=rank<=rivals.length?Math.floor(rivals[rank-1].projPoints+1e-8)+1:0;
    const targetPoints=Math.max(team.points,estimatedThreshold);
    let lockedPoints=team.points,chosen=0;
    for(const fixture of all){
      if(validPick(picks[fixture.id])){
        chosen++;
        lockedPoints+=outcome(picks[fixture.id],fixture,data.team).points;
      }
    }
    const open=all.length-chosen,need=Math.max(0,targetPoints-lockedPoints);
    const feasible=need<=3*open;
    let plan=null;
    if(feasible){
      // Prefer reaching the target without overshooting, then simpler W/D mixes.
      const possibilities=[];
      for(let wins=0;wins<=open;wins++){
        for(let draws=0;draws<=open-wins;draws++){
          const gained=3*wins+draws;
          if(gained>=need)possibilities.push({wins,draws,losses:open-wins-draws,points:gained});
        }
      }
      possibilities.sort((a,b)=>(a.points-need)-(b.points-need)||a.draws-b.draws||b.losses-a.losses);
      plan=possibilities[0]||null;
    }
    return {rank,targetPoints,lockedPoints,need,open,feasible,plan,maxPoints:lockedPoints+3*open,estimatedRivalCutoff:rank<=rivals.length?rivals[rank-1].projPoints:null};
  }
  function serializePredictions(data,picks={}){
    const scores=remainingFixtures(data).filter(f=>validPick(picks[f.id])).map(f=>[f.id,picks[f.id].homeScore,picks[f.id].awayScore]);
    return JSON.stringify({v:1,season:data.season,scores});
  }
  function parseSharedPredictions(data,encoded){
    if(typeof encoded!=='string'||encoded.length>12000)return null;
    try{
      const payload=JSON.parse(encoded);
      if(!payload||payload.v!==1||payload.season!==data.season||!Array.isArray(payload.scores))return null;
      const allowed=new Set(remainingFixtures(data).map(f=>f.id));
      if(payload.scores.length>data.standings.length*2)return null;
      const picks={};
      for(const row of payload.scores){
        if(!Array.isArray(row)||row.length!==3||typeof row[0]!=='string')return null;
        if(!allowed.has(row[0])||!isValidScore(row[1])||!isValidScore(row[2]))return null;
        picks[row[0]]={homeScore:row[1],awayScore:row[2]};
      }
      return picks;
    }catch{return null;}
  }
  return {key,opponent,remainingFixtures,validPick,outcome,forecast,ordinal,pointsTarget,serializePredictions,parseSharedPredictions};
});
