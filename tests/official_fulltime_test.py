import sys
import unittest
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'scripts'))
import official_fulltime as official


class OfficialSourceTests(unittest.TestCase):
    def test_source_urls_are_the_fa_pages(self):
        for page in ('table', 'results'):
            url=official.source_url(page)
            if page=='table':
                self.assertTrue(url.startswith('https://fulltime.thefa.com/table.html?'))
            else:
                self.assertTrue(url.startswith('https://fulltime.thefa.com/results/1/25.html?'))
            self.assertIn('selectedSeason=242517082',url)
            self.assertIn('selectedFixtureGroupKey=1_293688393',url)
        page_two=official.source_url('results',2)
        self.assertIn('/results/2/25.html?',page_two)
        self.assertIn('selectedRelatedFixtureOption=3',page_two)
        with self.assertRaises(ValueError):
            official.source_url('other')

    def test_official_table_parse(self):
        html='''<html><div id="league-table"><h2>Dorset Senior League</h2>
        <div class="table-scroll"><table><tbody>
        <tr><td>1</td><td><a>Canford United First</a></td><td>2</td><td>1</td>
        <td>0</td><td>1</td><td>1</td><td>3</td></tr>
        <tr><td>2</td><td><a>Stars Football Academy Stars FC</a></td>
        <td>2</td><td>1</td><td>0</td><td>1</td><td>-1</td><td>3 *</td></tr>
        </tbody></table></div></div></html>'''
        rows=official.parse_table(html)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['teamName'],'Canford United First')
        self.assertEqual(rows[1]['points'],3)
        self.assertEqual(rows[1]['goalDifference'],-1)
        with self.assertRaises(ValueError):
            official.parse_table(html.replace('Dorset Senior League','Dorset Division Six'))

    def test_parse_full_results_and_exclude_cup_games(self):
        html='''<div id="results-list"><div><div><div><div><div>
        <div class="match">
          <div class="fg-col">L</div><div class="datetime-col">05/09/26</div>
          <div class="home-team-col flex middle right">Canford United First</div>
          <div class="score-col">8 - 1 (HT 4-0)</div>
          <div class="road-team-col flex middle left">Poole Borough First</div>
        </div>
        <div class="match">
          <div class="fg-col">L</div><div class="datetime-col">12/09/26</div>
          <div class="home-team-col">Stars Football Academy Stars FC</div>
          <div class="score-col">2 - 1</div>
          <div class="road-team-col">Canford United First</div>
        </div>
        <div class="match">
          <div class="fg-col">CC</div><div class="datetime-col">31/10/26</div>
          <div class="home-team-col">Wareham Rangers First</div>
          <div class="score-col">2 - 1</div>
          <div class="road-team-col">Canford United First</div>
        </div>
        </div></div></div></div></div></div>'''
        rows=official.parse_results(html)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['homeScore'],'8')
        self.assertEqual(rows[0]['awayScore'],'1')
        self.assertEqual(rows[1]['awayTeam'],'Canford United First')
        with self.assertRaises(ValueError):
            official.parse_results('<p>This page was blocked</p>')


    def test_fetch_entire_division_across_result_pages(self):
        table='''<div id="league-table"><h2>Dorset Senior League</h2>
        <div class="table-scroll"><table><tbody>
        <tr><td>1</td><td><a>Canford United</a></td><td>2</td><td>1</td><td>0</td><td>1</td><td>0</td><td>3</td></tr>
        <tr><td>2</td><td><a>Stars FC</a></td><td>2</td><td>1</td><td>0</td><td>1</td><td>0</td><td>3</td></tr>
        </tbody></table></div></div>'''
        def page(home, away, hs, ass):
            return ('''<div id="results-list"><div class="match">
                <div class="datetime-col">05/09/26 14:00</div>
                <div class="home-team-col">'''+home+'''</div>
                <div class="score-col">'''+str(hs)+' - '+str(ass)+'''</div>
                <div class="road-team-col">'''+away+'''</div>
                <div class="fg-col">L</div>
                </div></div>''')
        calls=[]
        def fake_fetch(which, number=1):
            calls.append((which,number))
            if which=='table':return table
            if number==1:return page('Canford United','Stars FC',2,1)
            if number==2:return page('Stars FC','Canford United',2,1)
            raise AssertionError('Unexpected page request')
        with patch.object(official,'fetch_page',side_effect=fake_fetch):
            standings,results=official.fetch_official()
        self.assertEqual(len(standings),2)
        self.assertEqual(len(results),2)
        self.assertEqual(calls,[('table',1),('results',1),('results',2)])

    def test_pagination_does_not_accept_incomplete_results(self):
        table='''<div id="league-table"><h2>Dorset Senior League</h2>
        <div class="table-scroll"><table><tbody>
        <tr><td>1</td><td><a>Canford United</a></td><td>2</td><td>1</td><td>0</td><td>1</td><td>0</td><td>3</td></tr>
        <tr><td>2</td><td><a>Stars FC</a></td><td>2</td><td>1</td><td>0</td><td>1</td><td>0</td><td>3</td></tr>
        </tbody></table></div></div>'''
        empty='<div id="results-list"></div>'
        with patch.object(official,'fetch_page',side_effect=lambda page,number=1: table if page=='table' else empty):
            with self.assertRaises(ValueError):
                official.fetch_official()


if __name__=='__main__':
    unittest.main()
