"""
Insert TIC-LC seed rows via Supabase PostgREST using the anon key
(same pattern as seed_insert.py for the STS demo collab).

Teams + team_codes were already inserted via execute_sql; their IDs are
hardcoded below. This generates fresh assessment_responses + demographics +
tic_osa_responses rows (UUIDs are fresh each run — run ONCE).

NOTE: the assessment_responses INSERT policy requires the team_code to be
active and unexpired. The baseline codes expire 2026-06-08, so baseline
expiry must be temporarily extended (via execute_sql) before running this,
and restored afterward.
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
import seed_tic_demo_data as seed

random.seed(20260610)


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
    req = urllib.request.Request(f"{URL}/rest/v1/{table}",
                                 data=json.dumps(rows).encode('utf-8'),
                                 headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"{e.code} {e.reason} :: {body[:500]}")


# IDs of the team_codes inserted via execute_sql (scripts/tmp_tic_seed/001)
code_ids = {
    ('Harbor of Hope', 'baseline'):        'd7c11305-3925-4053-990c-191086e5f205',
    ('Harbor of Hope', 'endline'):         '4f23cfe4-e2a5-4f1c-97f4-c4737517bf1e',
    ('Safe Roots Collective', 'baseline'): 'd692824f-18ab-4626-91c4-a432c4d61b77',
    ('Safe Roots Collective', 'endline'):  'ca501326-3d2d-4686-907c-824bf9f80669',
    ('Resilience Rising', 'baseline'):     '4b1ff2a8-9982-4408-88a8-b5674ad709ad',
    ('Resilience Rising', 'endline'):      'ff84356f-f02d-4093-9430-6038d1700a55',
}

ar_rows, demo_rows, tic_rows = [], [], []
for t in seed.TEAMS:
    for tp in seed.TP_ORDER:
        for _ in range(t['n_per_tp'][tp]):
            ar_id = seed.rand_uuid()
            started = seed.rand_date_in_window(tp)
            completed = started + dt.timedelta(days=random.randint(0, 2))
            ar_rows.append({
                'id': ar_id,
                'team_code_id': code_ids[(t['team_name'], tp)],
                'timepoint': tp,
                'started_at': dt.datetime.combine(started, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                'completed_at': dt.datetime.combine(completed, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                'is_complete': True,
                'demographics_complete': True,
                'stss_complete': False,
                'proqol_complete': False,
                'stsioa_complete': False,
                'tic_osa_complete': True,
                'program_type': 'tic_lc',
            })
            demo_rows.append(seed.gen_demographics(ar_id))
            tic_rows.append(seed.gen_tic_osa(ar_id, t['profile'], tp))

print(f'Generated: ar={len(ar_rows)} demographics={len(demo_rows)} tic_osa={len(tic_rows)}')


def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def push(name, rows, size=100):
    print(f'>>> {name} ({len(rows)} rows)...', flush=True)
    done = 0
    for batch in chunk(rows, size):
        t0 = time.time()
        post(name, batch)
        done += len(batch)
        print(f'  {done}/{len(rows)} ({time.time()-t0:.1f}s)', flush=True)


push('assessment_responses', ar_rows, size=160)
push('demographics', demo_rows, size=160)
push('tic_osa_responses', tic_rows, size=50)

print('Done.')
