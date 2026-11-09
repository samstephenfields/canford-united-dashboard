import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import sync

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.previous={'standings':[
            {'name':'Canford United','played':0,'won':0,'drawn':0,'lost':0,'gd':0,'points':0,'gf':0,'ga':0},
            {'name':'Stars FC','played':0,'won':0,'drawn':0,'lost':0,'gd':0,'points':0,'gf':0,'ga':0}
        ],'scheduledFixtures':[]}
    def test_normalize_api_models(self):
        raw={'divisionName':'Dorset Senior League','table':[
            {'teamName':'Canford United First','gamesPlayed':1,'gamesWon':1,'gamesDrawn':0,'gamesLost':0,'goalDifference':1,'points':3},
            {'teamName':'Stars Football Academy Stars FC','gamesPlayed':1,'gamesWon':0,'gamesDrawn':0,'gamesLost':1,'goalDifference':-1,'points':0}
        ]}
        table=sync.standings_from_api(raw,self.previous)
        results=sync.results_from_api([{'fixtureDateTime':'09/11/26 14:00','homeTeam':'Canford United First','awayTeam':'Stars Football Academy Stars FC','homeScore':'2','awayScore':'1'}],table)
        self.assertEqual(len(results),1)
        self.assertEqual(table[0]['gf'],2)
        self.assertEqual(table[0]['ga'],1)
        fixtures=sync.fixtures_from_api([],results,self.previous)
        self.assertEqual(fixtures,[])
    def test_inconsistent_results_rejected(self):
        raw=[{'teamName':'Canford United','gamesPlayed':1,'gamesWon':1,'gamesDrawn':0,'gamesLost':0,'goalDifference':1,'points':3},
             {'teamName':'Stars FC','gamesPlayed':1,'gamesWon':0,'gamesDrawn':0,'gamesLost':1,'goalDifference':-1,'points':0}]
        table=sync.standings_from_api(raw,self.previous)
        with self.assertRaises(ValueError): sync.results_from_api([],table)
    def test_tbc_and_dates(self):
        self.assertEqual(sync.parse_date('14/11/26 14:00'),('2026-11-14','14:00'))
        self.assertEqual(sync.canonical('Parley Football Club'),'Parley')
        with self.assertRaises(ValueError):sync.canonical('Unknown club')
if __name__=='__main__':unittest.main()
