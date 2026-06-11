"""
Insert seed data via Supabase PostgREST API using the anon key.

Queries the already-inserted teams + team_codes (created via execute_sql) to get their IDs,
then generates and posts assessment_responses + child rows.

RLS allows anon inserts on assessment_responses (with valid team_code), demographics,
stss_responses, proqol_responses, stsioa_responses.
"""
import os
import sys
import urllib.request
import urllib.error
import json
import time
import random
import datetime as dt

sys.path.insert(0, os.path.dirname(__file__))
import seed_demo_data as seed

random.seed(42)

# Read .env.local
def load_env():
    env = {}
    with open(os.path.join(os.path.dirname(__file__), '..', '.env.local')) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            k, _, v = line.partition('=')
            env[k] = v
    return env

E = load_env()
URL = E['VITE_SUPABASE_URL']
KEY = E['VITE_SUPABASE_ANON_KEY']

HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}

def post(table, rows):
    url = f"{URL}/rest/v1/{table}"
    data = json.dumps(rows).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"{e.code} {e.reason} :: {body[:500]}")

# Hardcoded UUIDs for the teams + team_codes already inserted via execute_sql
# (extracted from tmp/seed/000.sql and 001.sql; the original generation used os.urandom UUIDs)
team_id_by_name = {
    'STS Busters':                 'ffef3ffa-c39b-4d66-b732-c4a6d77f9962',
    'Compassion Keepers':          '1f8f15dc-a5c9-4a10-ae74-3a3031295ccd',
    'Trauma-Informed Pathfinders': '5565905a-75a7-47e7-9d58-0baed9fc43e7',
}
code_ids = {
    ('STS Busters', 'baseline'):                 '7fd1f749-3c2a-471c-aceb-c10b2360cc29',
    ('STS Busters', 'endline'):                  '63b1c720-1fff-423f-9acb-75d14cbfe4e7',
    ('STS Busters', 'followup_6mo'):             '17ddc409-1571-47b6-82b6-4fa90994d62e',
    ('STS Busters', 'followup_12mo'):            'a06a5689-21f7-498d-a93a-6b0bc9faf753',
    ('Compassion Keepers', 'baseline'):          'a3c9b563-08e2-43fa-b11b-90d63cf18969',
    ('Compassion Keepers', 'endline'):           '9e25edb5-0893-4fe4-a489-90d228451197',
    ('Compassion Keepers', 'followup_6mo'):      'ab1f224f-689c-4eac-9324-f1fe08c741aa',
    ('Compassion Keepers', 'followup_12mo'):     '97550a21-52d5-4b5d-8168-b39821f1b497',
    ('Trauma-Informed Pathfinders', 'baseline'):      '753d85f8-520f-4568-b79e-0baceb81003b',
    ('Trauma-Informed Pathfinders', 'endline'):       '5d0f2e95-19b6-44de-9d06-51c9b5837a51',
    ('Trauma-Informed Pathfinders', 'followup_6mo'):  '469f2e67-418d-47e5-8c1f-567259048a85',
    ('Trauma-Informed Pathfinders', 'followup_12mo'): 'd037d1fc-ae88-49de-9ab2-1e84a6dec14f',
}

# 2) Generate AR + child rows
ar_rows, demo_rows, stss_rows, proqol_rows, stsioa_rows = [], [], [], [], []
for t in seed.TEAMS:
    for tp in seed.TP_ORDER:
        n = t['n_per_tp'][tp]
        tc_id = code_ids[(t['team_name'], tp)]
        for _ in range(n):
            ar_id = seed.rand_uuid()
            started = seed.rand_date_in_window(tp)
            completed = started + dt.timedelta(days=random.randint(0, 3))
            ar_rows.append({
                'id': ar_id,
                'team_code_id': tc_id,
                'timepoint': tp,
                'started_at': dt.datetime.combine(started, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                'completed_at': dt.datetime.combine(completed, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                'is_complete': True,
                'demographics_complete': True,
                'stss_complete': True,
                'proqol_complete': True,
                'stsioa_complete': True,
                'tic_osa_complete': False,
                'program_type': 'sts_bsc',
            })
            demo_rows.append(seed.gen_demographics(ar_id))
            stss_rows.append(seed.gen_stss(ar_id, t['profile'], tp))
            proqol_rows.append(seed.gen_proqol(ar_id, t['profile'], tp))
            stsioa_rows.append(seed.gen_stsioa(ar_id, t['profile'], tp))

print(f'\nGenerated:')
print(f'  assessment_responses: {len(ar_rows)}')
print(f'  demographics:         {len(demo_rows)}')
print(f'  stss_responses:       {len(stss_rows)}')
print(f'  proqol_responses:     {len(proqol_rows)}')
print(f'  stsioa_responses:     {len(stsioa_rows)}')

def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i+size]

def push(name, rows, size=200):
    print(f'\n>>> Inserting {name} ({len(rows)} rows)...', flush=True)
    n_done = 0
    for batch in chunk(rows, size):
        t0 = time.time()
        post(name, batch)
        n_done += len(batch)
        print(f'  ...{n_done}/{len(rows)} ({time.time()-t0:.1f}s)', flush=True)
    print(f'  done.')

push('assessment_responses', ar_rows, size=200)
push('demographics', demo_rows, size=200)
push('stss_responses', stss_rows, size=150)
push('proqol_responses', proqol_rows, size=100)
push('stsioa_responses', stsioa_rows, size=100)

print('\nAll seeds inserted successfully.')
