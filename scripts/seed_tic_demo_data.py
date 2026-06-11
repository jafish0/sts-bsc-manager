"""
Generate fake demo data for the TIC-LC demo collaborative
('Trauma-Informed Care for Providers and Helping Professionals Learning
Collaborative', d82cab03-3025-47b7-98e1-e893d6f522ae).

The tic_lc program flow administers ONLY demographics + TIC-OSA
(see frontend/src/config/programAssessments.js) — no STSS/ProQOL/STSI-OA.

Writes chunked SQL INSERT files to scripts/tmp_tic_seed/ in dependency order:
  000_teams.sql
  001_team_codes.sql
  01x_assessment_responses_*.sql
  02x_demographics_*.sql
  03x_tic_osa_*.sql

Timepoint windows match the live collaborative row:
  baseline 2026-05-12 .. 2026-06-08, endline 2026-09-15 .. 2026-10-13.
"""
import os
import uuid
import random
import datetime as dt

random.seed(20260610)  # reproducible

COLLAB_ID = 'd82cab03-3025-47b7-98e1-e893d6f522ae'
OUT_DIR = os.path.join(os.path.dirname(__file__), 'tmp_tic_seed')

TP_WINDOWS = {
    'baseline': (dt.date(2026, 5, 12), dt.date(2026, 6, 8)),
    'endline':  (dt.date(2026, 9, 15), dt.date(2026, 10, 13)),
}
TP_ORDER = ['baseline', 'endline']

TEAMS = [
    {
        'agency': 'Cumberland River Behavioral Health',
        'team_name': 'Harbor of Hope',
        'motto': 'Every door is the right door.',
        'staff': 64,
        'profile': 'avg',
        'n_per_tp': {'baseline': 58, 'endline': 54},
    },
    {
        'agency': 'Family Nurturing Center',
        'team_name': 'Safe Roots Collective',
        'motto': 'Growing safety from the ground up.',
        'staff': 38,
        'profile': 'low',
        'n_per_tp': {'baseline': 55, 'endline': 51},
    },
    {
        'agency': 'Mountain Comprehensive Care Center',
        'team_name': 'Resilience Rising',
        'motto': 'Steady hands, open hearts.',
        'staff': 112,
        'profile': 'ok',
        'n_per_tp': {'baseline': 52, 'endline': 50},
    },
]

# TIC-OSA item-level target means (1-4 Likert; HIGHER = more trauma-informed).
# Endline strictly better than baseline, with per-respondent variance.
TIC_TARGETS = {
    'low': {'baseline': 2.1, 'endline': 2.55},
    'avg': {'baseline': 2.6, 'endline': 3.05},
    'ok':  {'baseline': 2.9, 'endline': 3.35},
}

# Domain -> inclusive item-id ranges (frontend/src/config/ticOsa.js)
DOMAIN_RANGES = {
    'staff_development_score':   (1, 29),
    'safe_environment_score':    (30, 62),
    'assessing_planning_score':  (63, 88),
    'involving_consumers_score': (89, 91),
    'adapting_policies_score':   (92, 100),
}

GENDERS = ['F'] * 70 + ['M'] * 22 + ['NB'] * 5 + ['not_listed'] * 3
JOB_ROLES = ['Therapist', 'Case Manager', 'Social Worker', 'Nurse',
             'Peer Support Specialist', 'Intake Coordinator', 'Program Director', 'Other']


def rand_uuid():
    return str(uuid.uuid4())


def rand_clamped_normal(mean, sd, lo, hi):
    return max(lo, min(hi, round(random.gauss(mean, sd))))


def rand_date_in_window(tp):
    start, end = TP_WINDOWS[tp]
    return start + dt.timedelta(days=random.randint(0, (end - start).days))


def rand_code():
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=6))


def sql_val(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def emit_insert(table, cols, rows, batch_size=200):
    col_list = ', '.join(cols)
    stmts = []
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        values = ',\n  '.join('(' + ', '.join(sql_val(r.get(c)) for c in cols) + ')' for r in chunk)
        stmts.append(f"INSERT INTO {table} ({col_list}) VALUES\n  {values};\n")
    return stmts


def gen_demographics(ar_id):
    age = rand_clamped_normal(40, 10, 22, 65)
    yrs = rand_clamped_normal(8, 6, 0, 30)
    return {
        'id': rand_uuid(),
        'assessment_response_id': ar_id,
        'gender': random.choice(GENDERS),
        'age': age,
        'age_over_65': age >= 65,
        'years_in_service': yrs,
        'years_over_30': yrs >= 30,
        'job_role': random.choice(JOB_ROLES),
        'job_role_other': None,
        'areas_of_responsibility': None,
        'exposure_level': rand_clamped_normal(55, 22, 5, 100),
    }


def gen_tic_osa(ar_id, profile, tp):
    """Mirror TicOsa.jsx scoring: items 1-4 count toward domain sums;
    5 (Do Not Know) and 6 (N/A) are recorded but excluded from scores."""
    target = TIC_TARGETS[profile][tp]
    items = {}
    for i in range(1, 101):
        roll = random.random()
        if roll < 0.04:
            v = 5  # Do Not Know
        elif roll < 0.06:
            v = 6  # N/A
        else:
            v = rand_clamped_normal(target, 0.75, 1, 4)
        items[f'item_{i}'] = v

    row = {'id': rand_uuid(), 'assessment_response_id': ar_id, **items}
    total = 0
    for col, (lo, hi) in DOMAIN_RANGES.items():
        s = sum(items[f'item_{i}'] for i in range(lo, hi + 1) if 1 <= items[f'item_{i}'] <= 4)
        row[col] = s
        total += s
    row['total_score'] = total
    return row


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    team_rows, code_rows = [], []
    code_ids = {}
    for t in TEAMS:
        tid = rand_uuid()
        t['id'] = tid
        team_rows.append({
            'id': tid,
            'collaborative_id': COLLAB_ID,
            'agency_name': t['agency'],
            'team_name': t['team_name'],
            'team_motto': t['motto'],
            'estimated_staff_count': t['staff'],
            'display_name': t['team_name'],
            'motto': t['motto'],
        })
        for tp in TP_ORDER:
            cid = rand_uuid()
            code_ids[(t['team_name'], tp)] = cid
            _, end_date = TP_WINDOWS[tp]
            code_rows.append({
                'id': cid,
                'team_id': tid,
                'code': rand_code(),
                'timepoint': tp,
                'active': True,
                'expires_at': dt.datetime.combine(end_date, dt.time(23, 59, 59)).isoformat(),
            })

    ar_rows, demo_rows, tic_rows = [], [], []
    for t in TEAMS:
        for tp in TP_ORDER:
            for _ in range(t['n_per_tp'][tp]):
                ar_id = rand_uuid()
                started = rand_date_in_window(tp)
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
                demo_rows.append(gen_demographics(ar_id))
                tic_rows.append(gen_tic_osa(ar_id, t['profile'], tp))

    files = []

    def write(name, stmts):
        path = os.path.join(OUT_DIR, name)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(''.join(stmts))
        files.append(path)

    write('000_teams.sql', emit_insert(
        'teams',
        ['id', 'collaborative_id', 'agency_name', 'team_name', 'team_motto',
         'estimated_staff_count', 'display_name', 'motto'],
        team_rows))
    write('001_team_codes.sql', emit_insert(
        'team_codes',
        ['id', 'team_id', 'code', 'timepoint', 'active', 'expires_at'],
        code_rows))

    ar_cols = ['id', 'team_code_id', 'timepoint', 'started_at', 'completed_at', 'is_complete',
               'demographics_complete', 'stss_complete', 'proqol_complete', 'stsioa_complete',
               'tic_osa_complete', 'program_type']
    for n, stmt in enumerate(emit_insert('assessment_responses', ar_cols, ar_rows, batch_size=160)):
        write(f'01{n}_assessment_responses.sql', [stmt])

    demo_cols = ['id', 'assessment_response_id', 'gender', 'age', 'age_over_65',
                 'years_in_service', 'years_over_30', 'job_role', 'job_role_other',
                 'areas_of_responsibility', 'exposure_level']
    for n, stmt in enumerate(emit_insert('demographics', demo_cols, demo_rows, batch_size=160)):
        write(f'02{n}_demographics.sql', [stmt])

    tic_cols = (['id', 'assessment_response_id'] + [f'item_{i}' for i in range(1, 101)] +
                list(DOMAIN_RANGES.keys()) + ['total_score'])
    for n, stmt in enumerate(emit_insert('tic_osa_responses', tic_cols, tic_rows, batch_size=40)):
        write(f'03{n}_tic_osa.sql', [stmt])

    print(f'teams={len(team_rows)} codes={len(code_rows)} ar={len(ar_rows)} '
          f'demographics={len(demo_rows)} tic_osa={len(tic_rows)}')
    for p in files:
        print(' ', os.path.basename(p), f'{os.path.getsize(p)//1024}KB')


if __name__ == '__main__':
    main()
