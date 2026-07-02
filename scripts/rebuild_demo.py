"""
Full demo rebuild — 3 clean demo collaboratives (one per program).
See the 2026-06-10 "Full demo rebuild" draft in WORKING_NOTES.

DESTRUCTIVE. The wipe (`DELETE FROM collaboratives;`) and the demo_roster
column-add are run by Claude Code via the privileged Supabase MCP, NOT this
script. This script only:

  emit  → writes scripts/rebuild_out/structure.sql (collaboratives, events,
          teams incl. demo_roster, team_codes incl. CTAC real codes) and
          rebuild_out/ids.json. Claude runs structure.sql via execute_sql
          AFTER the wipe + demo_roster column exist.
  load  → reads ids.json and posts the bulk assessment rows via the anon
          PostgREST path (RLS allows anonymous assessment submission against
          an active, unexpired team_code). No service_role key needed.

Instrument data + scoring are REUSED from the existing generators
(seed_demo_data.py for STS-BSC, seed_tic_demo_data.py for TIC-LC) — not
reinvented here.

Usage:
  py scripts/rebuild_demo.py emit
  # (Claude runs the wipe + demo_roster column + structure.sql)
  py scripts/rebuild_demo.py load
"""
import os
import sys
import json
import uuid
import random
import datetime as dt

sys.path.insert(0, os.path.dirname(__file__))
import seed_demo_data as sts          # gen_demographics/stss/proqol/stsioa
import seed_tic_demo_data as tic      # gen_demographics/tic_osa

random.seed(6102026)

OUT_DIR = os.path.join(os.path.dirname(__file__), 'rebuild_out')
IDS_PATH = os.path.join(OUT_DIR, 'ids.json')

# Deterministic-ish UUIDs so emit + load agree without re-emitting.
def rid():
    return str(uuid.UUID(int=random.getrandbits(128), version=4))

# --- Program default events (transcribed from programConfig.js) ---
DEFAULT_EVENTS = {
    'sts_bsc': [
        ('learning_session', 'Learning Session 1', 1),
        ('learning_session', 'Learning Session 2', 2),
        ('learning_session', 'Learning Session 3', 3),
        ('all_team_call', 'All-Team Call 1 (Welcome & Orientation)', 1),
        ('all_team_call', 'All-Team Call 2', 2),
        ('all_team_call', 'All-Team Call 3', 3),
    ],
    'tic_lc': [
        ('all_team_call', 'Pre-training Call (Intro & LC Overview)', 1),
        ('learning_session', 'Learning Session 1', 1),
        ('learning_session', 'Learning Session 2', 2),
        ('learning_session', 'Learning Session 3', 3),
        ('learning_session', 'Learning Session 4', 4),
        ('all_team_call', 'Coaching Call 1', 2),
        ('all_team_call', 'Coaching Call 2', 3),
        ('all_team_call', 'Coaching Call 3', 4),
        ('all_team_call', 'Coaching Call 4', 5),
    ],
    'tipe_lc': [
        ('learning_session', 'Learning Session 1', 1),
        ('learning_session', 'Learning Session 2', 2),
        ('learning_session', 'Learning Session 3', 3),
        ('learning_session', 'Learning Session 4', 4),
        ('learning_session', 'Learning Session 5', 5),
        ('all_team_call', 'Learning Call 1', 1),
        ('all_team_call', 'Learning Call 2', 2),
        ('all_team_call', 'Learning Call 3', 3),
    ],
}
EVENT_BASE = {  # first event date; subsequent events step +21 days
    'sts_bsc': dt.date(2026, 6, 15),
    'tic_lc': dt.date(2026, 5, 12),
    'tipe_lc': dt.date(2025, 11, 12),
}

# --- Collaboratives ---
COLLABS = [
    {'key': 'sts_bsc', 'name': 'STS-BSC Demo', 'program': 'sts_bsc',
     'desc': 'Demonstration STS-BSC collaborative with mock team data.'},
    {'key': 'tic_lc', 'name': 'TIC LC Demo', 'program': 'tic_lc',
     'desc': 'Demonstration Trauma-Informed Care LC with mock team data.'},
    {'key': 'tipe_lc', 'name': 'TIPE LC Demo', 'program': 'tipe_lc',
     'desc': 'Demonstration TIPE LC — teams + resource library (no survey yet).'},
]

# --- Teams. profile ∈ {avg,low,ok}; has_data / has_roster / n_per_tp per draft. ---
STS_TEAMS = [
    {'agency': 'Southern Bluegrass DCBS', 'team': 'STS Busters', 'motto': 'Stop. Drop. Process.', 'profile': 'avg', 'staff': 80, 'n': {'baseline': 78, 'endline': 72}},
    {'agency': 'KVC Kentucky', 'team': 'Compassion Keepers', 'motto': 'Caring through the storm.', 'profile': 'low', 'staff': 200, 'n': {'baseline': 88, 'endline': 84}},
    {'agency': 'New Vista', 'team': 'Trauma-Informed Pathfinders', 'motto': 'Forging the way forward.', 'profile': 'ok', 'staff': 120, 'n': {'baseline': 65, 'endline': 61}},
    {'agency': 'Cumberland Valley DCBS', 'team': 'Bluegrass Guardians', 'motto': 'Steady in the hard moments.', 'profile': 'avg', 'staff': 70, 'n': {'baseline': 52, 'endline': 49}},
    {'agency': 'Pennyroyal Regional Center', 'team': 'Resilience Partners', 'motto': 'Stronger together.', 'profile': 'ok', 'staff': 60, 'n': {'baseline': 44, 'endline': 41}},
]
CTAC_TEAM = {'agency': 'Center on Trauma and Children', 'team': 'Center on Trauma and Children', 'motto': 'CTAC — University of Kentucky', 'staff': 25}

TIC_TEAMS = [
    {'agency': 'Aetna Better Health of KY', 'team': 'Aetna Care Navigators', 'motto': 'Whole-person care.', 'profile': 'avg', 'staff': 90, 'n': {'baseline': 72, 'endline': 68}},
    {'agency': 'Intrust Behavioral Health', 'team': 'Intrust Trauma Team', 'motto': 'Trust, informed.', 'profile': 'low', 'staff': 60, 'n': {'baseline': 55, 'endline': 51}},
    {'agency': 'KVC Kentucky', 'team': 'KVC TIC Cohort', 'motto': 'Every child, every family.', 'profile': 'ok', 'staff': 200, 'n': {'baseline': 84, 'endline': 80}},
    {'agency': 'Benchmark Family Services', 'team': 'Benchmark Bridge Team', 'motto': 'Bridging to safety.', 'profile': 'avg', 'staff': 55, 'n': {'baseline': 48, 'endline': 45}},
    {'agency': 'Necco & Associates', 'team': 'Necco Trauma-Informed Crew', 'motto': 'Meet people where they are.', 'profile': 'low', 'staff': 65, 'n': {'baseline': 61, 'endline': 57}},
    {"agency": "Sunrise Children's Services", 'team': 'Sunrise TIC Team', 'motto': 'New day, new hope.', 'profile': 'ok', 'staff': 110, 'n': {'baseline': 43, 'endline': 40}},
]

TIPE_TEAMS = [
    {'agency': 'Bullitt County Public Schools', 'team': 'Bullitt Bright Spots', 'motto': 'Calm, connected classrooms.', 'staff': 40},
    {'agency': 'Jackson County Schools', 'team': 'Jackson Resilience Crew', 'motto': 'Every student, every day.', 'staff': 25},
    {'agency': 'Jefferson County Public Schools', 'team': 'JCPS Trauma-Informed Team', 'motto': 'Safe, supported, ready to learn.', 'staff': 120},
    {'agency': 'Fayette County Public Schools', 'team': 'Fayette Anchors', 'motto': 'Anchored in relationships.', 'staff': 95},
    {'agency': 'Harlan County Public Schools', 'team': 'Harlan Hope Builders', 'motto': 'Mountains of resilience.', 'staff': 30},
    {'agency': 'Franklin County Schools', 'team': 'Franklin Steady Hands', 'motto': 'Steady hands, open hearts.', 'staff': 35},
]

# --- Roster name pools for demo_roster ---
FIRST = ['Ashley', 'Brandon', 'Casey', 'Diana', 'Elena', 'Frank', 'Gina', 'Hector', 'Irene', 'Jamal',
         'Kayla', 'Luis', 'Maria', 'Nathan', 'Olivia', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tanya',
         'Uma', 'Victor', 'Wendy', 'Xavier', 'Yolanda', 'Zach']
LAST = ['Adams', 'Bell', 'Carter', 'Diaz', 'Estes', 'Foster', 'Gomez', 'Hughes', 'Ingram', 'Jones',
        'Klein', 'Lopez', 'Meyer', 'Nguyen', 'Owens', 'Patel', 'Reed', 'Sanchez', 'Turner', 'Vaughn', 'Walsh']
STS_ROLES = ['Case Worker', 'Supervisor', 'Therapist', 'Family Service Worker', 'Resource Specialist', 'Administrator']
TIC_ROLES = ['Therapist', 'Case Manager', 'Social Worker', 'Nurse', 'Peer Support Specialist', 'Program Director']
EDU_ROLES = ['Teacher', 'School Counselor', 'School Psychologist', 'Assistant Principal', 'Social Worker', 'Behavior Interventionist']


def slug_email(full_name, agency):
    dom = ''.join(ch for ch in agency.lower() if ch.isalnum())[:14] or 'agency'
    return full_name.lower().replace(' ', '.') + '@' + dom + '.org'


def make_roster(agency, roles):
    n = random.randint(6, 10)  # 1 leader + 5-9 members
    used = set()
    people = []
    for i in range(n):
        while True:
            fn = f'{random.choice(FIRST)} {random.choice(LAST)}'
            if fn not in used:
                used.add(fn); break
        is_leader = (i == 0)
        people.append({
            'full_name': fn,
            'email': slug_email(fn, agency),
            'role': 'Team Leader' if is_leader else random.choice(roles),
            'is_senior_leader': is_leader and random.random() < 0.5,
        })
    return people


def sql_str(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def emit():
    os.makedirs(OUT_DIR, exist_ok=True)
    lines = ['-- Demo rebuild structure. Run AFTER: DELETE FROM collaboratives; + demo_roster column.', '']
    ids = {'collabs': {}, 'data_teams': [], 'ctac_codes': []}

    def collab_block(c):
        cid = rid()
        ids['collabs'][c['key']] = cid
        lines.append(f"INSERT INTO collaboratives (id, name, description, program_type, is_demo, start_date, status) VALUES")
        lines.append(f"  ({sql_str(cid)}, {sql_str(c['name'])}, {sql_str(c['desc'])}, {sql_str(c['program'])}, true, '2026-01-01', 'active');")
        # events
        base = EVENT_BASE[c['program']]
        evs = []
        for i, (etype, title, seq) in enumerate(DEFAULT_EVENTS[c['program']]):
            d = base + dt.timedelta(days=21 * i)
            evs.append(f"  ({sql_str(rid())}, {sql_str(cid)}, {sql_str(etype)}, {sql_str(title)}, '{d.isoformat()}', {seq})")
        lines.append("INSERT INTO bsc_events (id, collaborative_id, event_type, title, event_date, sequence_number) VALUES")
        lines.append(',\n'.join(evs) + ';')
        return cid

    def team_block(cid, agency, team, motto, staff, leader_name, leader_email, roster):
        tid = rid()
        roster_sql = 'NULL' if roster is None else f"{sql_str(json.dumps(roster))}::jsonb"
        lines.append("INSERT INTO teams (id, collaborative_id, agency_name, team_name, team_motto, estimated_staff_count, display_name, motto, team_leader_name, team_leader_email, demo_roster) VALUES")
        lines.append(f"  ({sql_str(tid)}, {sql_str(cid)}, {sql_str(agency)}, {sql_str(team)}, {sql_str(motto)}, {staff}, {sql_str(team)}, {sql_str(motto)}, {sql_str(leader_name)}, {sql_str(leader_email)}, {roster_sql});")
        return tid

    def codes_block(tid, tps):
        out = {}
        rows = []
        for tp in tps:
            cid = rid()
            out[tp] = cid
            rows.append(f"  ({sql_str(cid)}, {sql_str(tid)}, {sql_str(sts.rand_code())}, {sql_str(tp)}, true, '2027-12-31T23:59:59')")
        lines.append("INSERT INTO team_codes (id, team_id, code, timepoint, active, expires_at) VALUES")
        lines.append(',\n'.join(rows) + ';')
        return out

    # STS-BSC Demo
    sts_cid = collab_block(COLLABS[0])
    for t in STS_TEAMS:
        roster = make_roster(t['agency'], STS_ROLES)
        leader = roster[0]
        tid = team_block(sts_cid, t['agency'], t['team'], t['motto'], t['staff'], leader['full_name'], leader['email'], roster)
        codes = codes_block(tid, ['baseline', 'endline'])
        ids['data_teams'].append({'program': 'sts_bsc', 'profile': t['profile'], 'codes': codes, 'n': t['n']})
    # CTAC team — no roster, real codes across all 4 timepoints
    ctac_tid = team_block(sts_cid, CTAC_TEAM['agency'], CTAC_TEAM['team'], CTAC_TEAM['motto'], CTAC_TEAM['staff'], None, None, None)
    ctac_codes = codes_block(ctac_tid, ['baseline', 'endline', 'followup_6mo', 'followup_12mo'])
    ids['ctac_codes'] = [{'timepoint': tp, 'code_id': cid} for tp, cid in ctac_codes.items()]

    # TIC LC Demo
    tic_cid = collab_block(COLLABS[1])
    for t in TIC_TEAMS:
        roster = make_roster(t['agency'], TIC_ROLES)
        leader = roster[0]
        tid = team_block(tic_cid, t['agency'], t['team'], t['motto'], t['staff'], leader['full_name'], leader['email'], roster)
        codes = codes_block(tid, ['baseline', 'endline'])
        ids['data_teams'].append({'program': 'tic_lc', 'profile': t['profile'], 'codes': codes, 'n': t['n']})

    # TIPE LC Demo — teams + rosters, no codes/data
    tipe_cid = collab_block(COLLABS[2])
    for t in TIPE_TEAMS:
        roster = make_roster(t['agency'], EDU_ROLES)
        leader = roster[0]
        team_block(tipe_cid, t['agency'], t['team'], t['motto'], t['staff'], leader['full_name'], leader['email'], roster)

    with open(os.path.join(OUT_DIR, 'structure.sql'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    with open(IDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(ids, f, indent=2)

    n_codes = sum(len(d['codes']) for d in ids['data_teams']) + len(ids['ctac_codes'])
    print(f"emit done: 3 collaboratives, {5+1+6+6} teams, {n_codes} team_codes.")
    print(f"  structure.sql + ids.json in {OUT_DIR}")
    print(f"  data teams: {len(ids['data_teams'])} (STS 5 + TIC 6); CTAC codes: {len(ids['ctac_codes'])}")


def load():
    import urllib.request, urllib.error
    with open(IDS_PATH) as f:
        ids = json.load(f)
    env = {}
    with open(os.path.join(os.path.dirname(__file__), '..', '.env.local')) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                env[k] = v
    URL, KEY = env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']
    H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

    def post(table, rows):
        req = urllib.request.Request(f'{URL}/rest/v1/{table}', data=json.dumps(rows).encode(), headers=H, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.status
        except urllib.error.HTTPError as e:
            raise RuntimeError(f'{e.code} {e.reason} :: {e.read().decode("utf-8","replace")[:400]}')

    def chunked(rows, size):
        for i in range(0, len(rows), size):
            yield rows[i:i+size]

    ar_rows, demo_rows, stss_rows, proqol_rows, stsioa_rows, tic_rows = [], [], [], [], [], []
    for team in ids['data_teams']:
        prog, profile = team['program'], team['profile']
        for tp, code_id in team['codes'].items():
            for _ in range(team['n'][tp]):
                ar_id = sts.rand_uuid()
                win = sts if prog == 'sts_bsc' else tic
                started = win.rand_date_in_window(tp)
                completed = started + dt.timedelta(days=random.randint(0, 2))
                ar_rows.append({
                    'id': ar_id, 'team_code_id': code_id, 'timepoint': tp,
                    'started_at': dt.datetime.combine(started, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                    'completed_at': dt.datetime.combine(completed, dt.time(random.randint(8, 17), random.randint(0, 59))).isoformat(),
                    'is_complete': True, 'demographics_complete': True,
                    'stss_complete': prog == 'sts_bsc', 'proqol_complete': prog == 'sts_bsc',
                    'stsioa_complete': prog == 'sts_bsc', 'tic_osa_complete': prog == 'tic_lc',
                    'program_type': prog,
                })
                if prog == 'sts_bsc':
                    demo_rows.append(sts.gen_demographics(ar_id))
                    stss_rows.append(sts.gen_stss(ar_id, profile, tp))
                    proqol_rows.append(sts.gen_proqol(ar_id, profile, tp))
                    stsioa_rows.append(sts.gen_stsioa(ar_id, profile, tp))
                else:
                    demo_rows.append(tic.gen_demographics(ar_id))
                    tic_rows.append(tic.gen_tic_osa(ar_id, profile, tp))

    print(f'Generated: ar={len(ar_rows)} demo={len(demo_rows)} stss={len(stss_rows)} '
          f'proqol={len(proqol_rows)} stsioa={len(stsioa_rows)} tic_osa={len(tic_rows)}')

    def push(name, rows, size):
        if not rows:
            return
        done = 0
        for batch in chunked(rows, size):
            post(name, batch)
            done += len(batch)
            print(f'  {name}: {done}/{len(rows)}', flush=True)

    push('assessment_responses', ar_rows, 200)
    push('demographics', demo_rows, 200)
    push('stss_responses', stss_rows, 150)
    push('proqol_responses', proqol_rows, 100)
    push('stsioa_responses', stsioa_rows, 60)
    push('tic_osa_responses', tic_rows, 40)
    print('load done.')


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'emit':
        emit()
    elif mode == 'load':
        load()
    else:
        print('usage: py rebuild_demo.py [emit|load]')
        sys.exit(1)
