#!/usr/bin/env python3
"""Refresh a 2026/27 Dorset Senior League snapshot from public FA Full-Time.

Never publish unverified or partially parsed results. Keep the last verified
snapshot when the FA source cannot be fetched or has changed its markup.
"""
import copy
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / 'public' / 'data' / 'season.json'
DIVISION_ID = '69783872'
TEAM = 'Canford United'

ALIASES = {
    'canford united first': TEAM,
    'canford united': TEAM,
    'stars football academy stars fc': 'Stars FC',
    'stars fc': 'Stars FC',
    'stars': 'Stars FC',
    'maiden newton & cattistock first': 'Maiden Newton & Cattistock',
    'maiden newton & cattistock': 'Maiden Newton & Cattistock',
    'cobham sports fc reserves': 'Cobham Sports Reserves',
    'cobham sports reserves': 'Cobham Sports Reserves',
    'parley football club': 'Parley',
    'parley': 'Parley',
    'bournemouth sports reserves': 'Bournemouth Sports Reserves',
    'shaftesbury reserves': 'Shaftesbury Reserves',
    'tisbury united first': 'Tisbury United',
    'tisbury united': 'Tisbury United',
    'westland sports reserves': 'Westland Sports Reserves',
    'bournemouth poppies reserves': 'Bournemouth Poppies Reserves',
    'bournemouth reserves': 'Bournemouth Poppies Reserves',
    'poole borough first': 'Poole Borough',
    'poole borough': 'Poole Borough',
}

def pick(obj, *keys, default=None):
    if not isinstance(obj, dict):
        return default
    index = {str(k).lower(): v for k, v in obj.items()}
    for key in keys:
        if key.lower() in index and index[key.lower()] is not None:
            return index[key.lower()]
    return default

def canonical(name):
    text = ' '.join(str(name or '').split()).strip().lower()
    if text not in ALIASES:
        raise ValueError('Unrecognized team (requires name mapping): ' + str(name))
    return ALIASES[text]

def number(value):
    if isinstance(value, bool):
        raise ValueError('Boolean number received')
    if isinstance(value, (int,float)) and value == int(value):
        return int(value)
    value = str(value).strip().replace('−','-').replace('*','')
    return int(value)

def parse_date(value):
    if not value:
        raise ValueError('Missing fixture date')
    text = str(value).strip()
    for spec in ('%d/%m/%y %H:%M','%d/%m/%Y %H:%M','%a %d %b %y %H:%M','%d %b %y %H:%M','%Y-%m-%dT%H:%M:%S','%Y-%m-%dT%H:%M:%SZ','%d/%m/%y','%d/%m/%Y','%a %d %b %y','%d %b %y','%d %B %Y','%Y-%m-%d'):
        try:
            date = dt.datetime.strptime(text,spec)
            return date.strftime('%Y-%m-%d'), date.strftime('%H:%M') if ':' in text else None
        except ValueError:
            pass
    raise ValueError('Unrecognized date: '+text)

def standings_from_api(raw,previous):
    rows = raw if isinstance(raw,list) else pick(raw,'table','standings','leagueTable')
    if not isinstance(rows,list):
        raise ValueError('Missing table array in response')
    original={r['name']:r for r in previous['standings']}
    normalized=[]
    for row in rows:
        name=canonical(pick(row,'teamName','team','name'))
        played=number(pick(row,'gamesPlayed','played','p'))
        won=number(pick(row,'gamesWon','won','w'))
        drawn=number(pick(row,'gamesDrawn','drawn','d'))
        lost=number(pick(row,'gamesLost','lost','l'))
        gd=number(pick(row,'goalDifference','gd'))
        points=number(pick(row,'points','pts'))
        if played!=won+drawn+lost or played>20 or played<0:
            raise ValueError(f'Invalid WDL for {name}')
        if points>won*3+drawn:
            raise ValueError(f'Unexpected points for {name}')
        older=original.get(name,{})
        gf=older.get('gf') if older.get('played')==played else None
        ga=older.get('ga') if older.get('played')==played else None
        normalized.append({'name':name,'played':played,'won':won,'drawn':drawn,'lost':lost,'gd':gd,'points':points,'gf':gf,'ga':ga})
    if len(normalized)!=len(previous['standings']) or set(r['name'] for r in normalized)!=set(original):
        raise ValueError('Table membership mismatch; manual review needed')
    return sorted(normalized,key=lambda r:(-r['points'],-r['gd'],r['name']))

def results_from_api(raw,standings,previous_results=None):
    rows=raw if isinstance(raw,list) else pick(raw,'results','matches')
    if not isinstance(rows,list):
        raise ValueError('Missing results array')
    output=[]
    for row in rows:
        home=canonical(pick(row,'homeTeam','home'))
        away=canonical(pick(row,'awayTeam','away'))
        if home==away:raise ValueError('A team is playing itself')
        date,_=parse_date(pick(row,'fixtureDateTime','dateTime','date'))
        hs=pick(row,'homeScore','homeGoals')
        ass=pick(row,'awayScore','awayGoals')
        if hs is None or ass is None:
            nums=re.match(r'^\s*(\d+)\s*[-–]\s*(\d+)',str(pick(row,'score','fullScore',default='')))
            if not nums:raise ValueError('Missing score for '+str(row))
            hs,ass=nums.groups()
        hs,ass=number(hs),number(ass)
        if hs<0 or ass<0:raise ValueError('Negative score')
        output.append({'date':date,'home':home,'away':away,'homeScore':hs,'awayScore':ass})
    # Some Full-Time views expose a limited recent-results window.
    # Merge newly fetched pairings with previously verified matches, so a
    # partial response cannot erase the season history.
    unique={(r['home'],r['away']):dict(r) for r in (previous_results or [])}
    for row in output:
        unique[(row['home'],row['away'])]=row
    output=sorted(unique.values(),key=lambda r:(r['date'],r['home'],r['away']))
    counts={x['name']:0 for x in standings}
    totals={x['name']:[0,0] for x in standings}
    for r in output:
        if r['home'] not in counts or r['away'] not in counts:
            raise ValueError('Result includes a team outside this league')
        counts[r['home']]+=1;counts[r['away']]+=1
        totals[r['home']][0]+=r['homeScore'];totals[r['home']][1]+=r['awayScore']
        totals[r['away']][0]+=r['awayScore'];totals[r['away']][1]+=r['homeScore']
    for r in standings:
        name=r['name']
        if counts[name]>r['played']:
            raise ValueError('More result rows than games played for '+name)
        # Require every Canford match: otherwise the predictor would miscount
        # the remaining fixtures and the captain's season view would be wrong.
        if name==TEAM and counts[name]!=r['played']:
            raise ValueError('Missing Canford league results; retaining previous snapshot')
        if counts[name]==r['played']:
            gf,ga=totals[name]
            if gf-ga!=r['gd']:
                raise ValueError('Goals conflict with league GD for '+name)
            r['gf'],r['ga']=gf,ga
        else:
            r['gf'],r['ga']=None,None
    return output

def fixtures_from_api(raw,results,previous):
    rows=raw if isinstance(raw,list) else pick(raw,'fixtures','matches')
    if not isinstance(rows,list):raise ValueError('Missing fixture array')
    finished={(x['home'],x['away']) for x in results}
    output={}
    for row in rows:
        home=canonical(pick(row,'homeTeam','home'))
        away=canonical(pick(row,'awayTeam','away'))
        if TEAM not in (home,away) or (home,away) in finished:continue
        try:
            date,time=parse_date(pick(row,'fixtureDateTime','dateTime','date'))
        except ValueError:
            continue  # The league has not scheduled this match yet.
        output[(home,away)]={'date':date,'time':time or 'Time TBC','home':home,'away':away,'venue':str(pick(row,'location','venue',default='Venue TBC'))}
    # Preserve previously published fixtures if a temporary API issue returns
    # fewer fixtures; completed matches are always removed.
    for old in previous['scheduledFixtures']:
        pair=(old['home'],old['away'])
        if pair not in finished and pair not in output:
            output[pair]=old
    return sorted(output.values(),key=lambda r:(r['date'],r['home']))

def sync():
    previous=json.loads(DATA_PATH.read_text(encoding='utf-8'))
    # Public official pages are the only default source. No third-party API.
    from official_fulltime import fetch_official
    table, results = fetch_official()
    # Previously published fixture dates are preserved unless a match is
    # completed; this results-only source does not claim to refresh fixtures.
    fixtures=[]
    next_data=copy.deepcopy(previous)
    next_data['standings']=standings_from_api(table,previous)
    next_data['results']=results_from_api(results,next_data['standings'],previous.get('results'))
    expected_matches=sum(row['played'] for row in next_data['standings'])
    if expected_matches%2 or len(next_data['results'])!=expected_matches//2:
        raise ValueError(
            f'Official results incomplete: {len(next_data["results"])} of '
            f'{expected_matches//2} completed league matches supplied'
        )
    next_data['scheduledFixtures']=fixtures_from_api(fixtures,next_data['results'],previous)
    current=next(r for r in next_data['standings'] if r['name']==TEAM)
    older=next(r for r in previous['standings'] if r['name']==TEAM)
    if current['played']<older['played']:
        raise ValueError('Fetched season appears older than the saved snapshot')
    if any(r['date']<'2026-07-01' or r['date']>'2027-07-01' for r in next_data['results']):
        raise ValueError('Results appear to be from the wrong season')
    latest=max((r['date'] for r in next_data['results']),default=previous['dataAsOf'])
    next_data['dataAsOf']=latest
    # Record every successful check, even if scores have not changed.
    now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    ignored=('lastSuccessfulSync','sourceNote','lastCheckedAt','lastCheckStatus','lastCheckIssue')
    old_data={k:v for k,v in previous.items() if k not in ignored}
    new_data={k:v for k,v in next_data.items() if k not in ignored}
    changed=(old_data!=new_data)
    next_data['lastCheckedAt']=now
    next_data['lastCheckStatus']='ok'
    next_data.pop('lastCheckIssue',None)
    if changed:
        next_data['lastSuccessfulSync']=now
        next_data['sourceNote']='Public FA Full-Time Dorset Senior League table and results (fulltime.thefa.com).'
    tmp=DATA_PATH.with_suffix('.tmp')
    tmp.write_text(json.dumps(next_data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    tmp.replace(DATA_PATH)
    print(('Updated league data through ' if changed else 'Verified unchanged league data through ')+latest)

if __name__=='__main__':
    try:
        sync()
    except (HTTPError,URLError,TimeoutError,ValueError,KeyError,TypeError, OSError, json.JSONDecodeError) as exc:
        print('Data refresh skipped; keeping last verified snapshot: '+str(exc),file=sys.stderr)
        # Keep old verified football data; update only the freshness indicator.
        # The workflow should still publish the static page rather than fail closed.
        try:
            previous=json.loads(DATA_PATH.read_text(encoding='utf-8'))
            previous['lastCheckedAt']=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
            previous['lastCheckStatus']='failed'
            previous['lastCheckIssue']='The latest data could not be verified; results may be out of date.'
            tmp=DATA_PATH.with_suffix('.tmp')
            tmp.write_text(json.dumps(previous,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
            tmp.replace(DATA_PATH)
        except (OSError,ValueError,json.JSONDecodeError) as stamp_error:
            print('Could not record failure status: '+str(stamp_error),file=sys.stderr)
        print('::warning::Upstream league data refresh failed; website is displaying last verified results.')
        if '--strict' in sys.argv:
            sys.exit(1)
