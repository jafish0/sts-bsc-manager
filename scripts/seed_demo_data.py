"""
Generate fake demo data for the Demo 2026 STS-BSC Collaborative.

Outputs SQL INSERT statements to stdout (or to a file via redirect), in the order:
1. teams
2. team_codes
3. assessment_responses
4. demographics
5. stss_responses
6. proqol_responses
7. stsioa_responses

Each major section is a separate statement so chunks can be executed independently.
"""
import uuid
import random
import datetime as dt
import sys

random.seed(42)  # reproducible across runs

# ----- Configuration -----

COLLAB_ID = 'aa91e6ec-c3a5-4eaf-a1ad-4af8af984299'

TP_WINDOWS = {
    'baseline':       (dt.date(2026, 6, 29), dt.date(2026, 7, 26)),
    'endline':        (dt.date(2026, 9, 22), dt.date(2026, 10, 20)),
    'followup_6mo':   (dt.date(2027, 2, 14), dt.date(2027, 3, 28)),
    'followup_12mo':  (dt.date(2027, 8, 18), dt.date(2027, 9, 29)),
}
TP_ORDER = ['baseline', 'endline', 'followup_6mo', 'followup_12mo']

TEAMS = [
    {
        'agency': 'Southern Bluegrass DCBS',
        'team_name': 'STS Busters',
        'motto': 'Stop. Drop. Process.',
        'staff': 80,
        'profile': 'avg',
        'n_per_tp': {'baseline': 55, 'endline': 53, 'followup_6mo': 49, 'followup_12mo': 47},
    },
    {
        'agency': 'KVC Kentucky',
        'team_name': 'Compassion Keepers',
        'motto': 'Caring through the storm.',
        'staff': 200,
        'profile': 'low',
        'n_per_tp': {'baseline': 102, 'endline': 96, 'followup_6mo': 88, 'followup_12mo': 81},
    },
    {
        'agency': 'New Vista',
        'team_name': 'Trauma-Informed Pathfinders',
        'motto': 'Forging the way forward.',
        'staff': 329,
        'profile': 'ok',
        'n_per_tp': {'baseline': 105, 'endline': 99, 'followup_6mo': 92, 'followup_12mo': 86},
    },
]

# STSI-OA item-level target means by profile and timepoint (1-5 scale, 5=best)
# Each timepoint must be strictly better than the previous (monotonic improvement).
STSIOA_TARGETS = {
    'avg': {'baseline': 3.0, 'endline': 3.3, 'followup_6mo': 3.5, 'followup_12mo': 3.8},
    'low': {'baseline': 2.0, 'endline': 2.2, 'followup_6mo': 2.4, 'followup_12mo': 2.7},
    'ok':  {'baseline': 3.2, 'endline': 3.5, 'followup_6mo': 3.7, 'followup_12mo': 4.0},
}

# Per-item targets for the 'avg' profile (STS Busters) — gives a clear "items going green
# over time" narrative on the Office Visual instead of uniformly yellow cells.
# Items are grouped by improvement velocity to mirror real BSC progress patterns:
# training/supervision items move first, leadership behaviors follow, structural items last.
EARLY_WIN_ITEMS = {'1a', '5a', '5b', '5c', '4f'}  # 5 items — green by endline
MID_WIN_ITEMS   = {'4a', '4b', '6a'}              # 3 items — green by 6-month follow-up
LATE_WIN_ITEMS  = {'1f', '5d'}                    # 2 items — green by 12-month follow-up

STSIOA_AVG_PER_ITEM_TARGETS = {
    'early': {'baseline': 3.4, 'endline': 4.2, 'followup_6mo': 4.4, 'followup_12mo': 4.6},
    'mid':   {'baseline': 2.9, 'endline': 3.5, 'followup_6mo': 4.1, 'followup_12mo': 4.4},
    'late':  {'baseline': 2.6, 'endline': 3.0, 'followup_6mo': 3.5, 'followup_12mo': 4.1},
    'other': {'baseline': 2.8, 'endline': 3.0, 'followup_6mo': 3.3, 'followup_12mo': 3.6},
}

def stsioa_item_target(item_id, profile, tp):
    """Return the per-item target mean for STSI-OA generation.
    For the 'avg' profile (STS Busters) we shape per-item velocities to make
    progress visible item-by-item on the Office Visual. Other profiles use
    the flat team-level target."""
    if profile != 'avg':
        return STSIOA_TARGETS[profile][tp]
    if item_id in EARLY_WIN_ITEMS:
        bucket = 'early'
    elif item_id in MID_WIN_ITEMS:
        bucket = 'mid'
    elif item_id in LATE_WIN_ITEMS:
        bucket = 'late'
    else:
        bucket = 'other'
    return STSIOA_AVG_PER_ITEM_TARGETS[bucket][tp]

# STSS item-level target means (1-5; HIGHER = MORE distress = WORSE)
# Each timepoint must be strictly lower than the previous (monotonic improvement).
STSS_TARGETS = {
    'avg': {'baseline': 1.9, 'endline': 1.7, 'followup_6mo': 1.6, 'followup_12mo': 1.4},
    'low': {'baseline': 2.7, 'endline': 2.5, 'followup_6mo': 2.3, 'followup_12mo': 2.1},
    'ok':  {'baseline': 1.9, 'endline': 1.7, 'followup_6mo': 1.6, 'followup_12mo': 1.4},
}

# ProQOL item-level targets (1-5; per-subscale).
# CS = Compassion Satisfaction (HIGH = good).
# Burnout/STS scale targets are post-reverse — for reverse-scored burnout items we generate raw = 6 - target.
PROQOL_TARGETS = {
    'avg': {'cs': 3.6, 'burnout': 2.5, 'sts': 2.0},
    'low': {'cs': 2.7, 'burnout': 3.6, 'sts': 2.8},
    'ok':  {'cs': 3.8, 'burnout': 2.4, 'sts': 1.9},
}

# Per-timepoint trend offsets applied to ProQOL targets — strictly monotonic
# (CS rises each timepoint, burnout/STS fall each timepoint).
PROQOL_TREND = {
    'baseline':      {'cs': 0.0,  'burnout': 0.0,  'sts': 0.0},
    'endline':       {'cs': 0.15, 'burnout': -0.15, 'sts': -0.15},
    'followup_6mo':  {'cs': 0.30, 'burnout': -0.30, 'sts': -0.30},
    'followup_12mo': {'cs': 0.45, 'burnout': -0.45, 'sts': -0.45},
}

# ProQOL subscale assignments (per frontend/src/config/proqol.js)
PROQOL_CS = {3, 6, 12, 16, 18, 20, 22, 24, 27, 30}
PROQOL_BURNOUT = {1, 4, 8, 10, 15, 17, 19, 21, 26, 29}
PROQOL_BURNOUT_REVERSE = {1, 4, 15, 17, 29}
PROQOL_STS = {2, 5, 7, 9, 11, 13, 14, 23, 25, 28}

# STSI-OA item ids in non-underscore format (the rendering reads these)
STSIOA_ITEM_IDS = (
    ['1a','1b','1c','1d','1e','1f','1g'] +
    ['2a','2b','2c','2d','2e','2f','2g'] +
    ['3a','3b','3c','3d','3e','3f'] +
    ['4a','4b','4c','4d','4e','4f','4g','4h','4i'] +
    ['5a','5b','5c','5d','5e','5f','5g'] +
    ['6a','6b','6c','6d']
)
STSIOA_DOMAIN_OF = {}
for ids, dom in [
    (['1a','1b','1c','1d','1e','1f','1g'], 1),
    (['2a','2b','2c','2d','2e','2f','2g'], 2),
    (['3a','3b','3c','3d','3e','3f'], 3),
    (['4a','4b','4c','4d','4e','4f','4g','4h','4i'], 4),
    (['5a','5b','5c','5d','5e','5f','5g'], 5),
    (['6a','6b','6c','6d'], 6),
]:
    for i in ids:
        STSIOA_DOMAIN_OF[i] = dom

# STSS subscale items (1-indexed); per frontend/src/utils/constants.js
STSS_INTRUSION = {2, 3, 6, 10, 13}
STSS_AVOIDANCE = {1, 9, 12, 14}
# arousal_score column captures items NOT in the other two subscales (DSM-5 collapses neg_cog into arousal column for DB)
STSS_AROUSAL_DB = set(range(1, 18)) - STSS_INTRUSION - STSS_AVOIDANCE  # = items 4,5,7,8,11,15,16,17

# Demographics options
GENDERS = ['F'] * 70 + ['M'] * 22 + ['NB'] * 5 + ['not_listed'] * 3   # weighted ~70/22/5/3
JOB_ROLES = ['Caseworker', 'Supervisor', 'Therapist', 'Family Service Worker',
             'Resource Specialist', 'Investigations', 'Administrator', 'Other']

# ----- Helpers -----

def rand_uuid():
    return str(uuid.uuid4())

def rand_clamped_normal(mean, sd, lo, hi):
    """Draw integer from Normal(mean, sd), round, clamp to [lo, hi]."""
    v = random.gauss(mean, sd)
    v = round(v)
    return max(lo, min(hi, v))

def rand_date_in_window(tp):
    start, end = TP_WINDOWS[tp]
    delta = (end - start).days
    return start + dt.timedelta(days=random.randint(0, delta))

def rand_code():
    """6-char alphanumeric code, uppercase."""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # exclude confusing chars
    return ''.join(random.choices(chars, k=6))

def sql_str(s):
    if s is None:
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def sql_val(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dt.date):
        return f"'{v.isoformat()}'"
    if isinstance(v, list):
        # Postgres array literal
        inner = ','.join('"' + str(x).replace('"', '\\"') + '"' for x in v)
        return f"'{{{inner}}}'"
    return sql_str(str(v))

def emit_insert(table, cols, rows, batch_size=200):
    """Yield SQL INSERT statements with up to batch_size rows each."""
    if not rows:
        return
    col_list = ', '.join(cols)
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        values = []
        for r in chunk:
            vals = ', '.join(sql_val(r.get(c)) for c in cols)
            values.append(f"({vals})")
        yield f"INSERT INTO {table} ({col_list}) VALUES\n  " + ',\n  '.join(values) + ';\n'

# ----- Data generation -----

def gen_demographics(ar_id):
    age = rand_clamped_normal(40, 10, 22, 65)
    yrs = rand_clamped_normal(8, 6, 0, 30)
    expo = rand_clamped_normal(60, 20, 10, 100)
    role = random.choice(JOB_ROLES)
    return {
        'id': rand_uuid(),
        'assessment_response_id': ar_id,
        'gender': random.choice(GENDERS),
        'age': age,
        'age_over_65': age >= 65,
        'years_in_service': yrs,
        'years_over_30': yrs >= 30,
        'job_role': role,
        'job_role_other': None,
        'areas_of_responsibility': None,  # ARRAY column — leave null
        'exposure_level': expo,
    }

def gen_stss(ar_id, profile, tp):
    target = STSS_TARGETS[profile][tp]
    items = {}
    for i in range(1, 18):
        items[f'item_{i}'] = rand_clamped_normal(target, 0.7, 1, 5)
    intrusion = sum(items[f'item_{i}'] for i in STSS_INTRUSION)
    avoidance = sum(items[f'item_{i}'] for i in STSS_AVOIDANCE)
    arousal   = sum(items[f'item_{i}'] for i in STSS_AROUSAL_DB)
    total = sum(items.values())
    return {
        'id': rand_uuid(),
        'assessment_response_id': ar_id,
        **items,
        'intrusion_score': intrusion,
        'avoidance_score': avoidance,
        'arousal_score': arousal,
        'total_score': total,
    }

def gen_proqol(ar_id, profile, tp):
    base = PROQOL_TARGETS[profile]
    trend = PROQOL_TREND[tp]
    cs_t = base['cs'] + trend['cs']
    bu_t = base['burnout'] + trend['burnout']
    st_t = base['sts'] + trend['sts']
    items = {}
    for i in range(1, 31):
        if i in PROQOL_CS:
            v = rand_clamped_normal(cs_t, 0.7, 1, 5)
        elif i in PROQOL_BURNOUT:
            if i in PROQOL_BURNOUT_REVERSE:
                # Raw value will be reversed to compute score: post-reverse mean = bu_t
                # so raw mean should be 6 - bu_t
                v = rand_clamped_normal(6 - bu_t, 0.7, 1, 5)
            else:
                v = rand_clamped_normal(bu_t, 0.7, 1, 5)
        elif i in PROQOL_STS:
            v = rand_clamped_normal(st_t, 0.7, 1, 5)
        else:
            v = rand_clamped_normal(3, 0.7, 1, 5)  # shouldn't happen
        items[f'item_{i}'] = v
    # Compute scores
    cs_score = sum(items[f'item_{i}'] for i in PROQOL_CS)
    burnout_score = 0
    for i in PROQOL_BURNOUT:
        raw = items[f'item_{i}']
        burnout_score += (6 - raw) if i in PROQOL_BURNOUT_REVERSE else raw
    sts_score = sum(items[f'item_{i}'] for i in PROQOL_STS)
    return {
        'id': rand_uuid(),
        'assessment_response_id': ar_id,
        **items,
        'compassion_satisfaction_score': cs_score,
        'burnout_score': burnout_score,
        'secondary_trauma_score': sts_score,
    }

def gen_stsioa(ar_id, profile, tp):
    items = {}
    domain_sums = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
    for iid in STSIOA_ITEM_IDS:
        target = stsioa_item_target(iid, profile, tp)
        v = rand_clamped_normal(target, 0.8, 1, 5)
        items[f'item_{iid}'] = v
        domain_sums[STSIOA_DOMAIN_OF[iid]] += v
    total = sum(domain_sums.values())
    return {
        'id': rand_uuid(),
        'assessment_response_id': ar_id,
        **items,
        'domain_1_score': domain_sums[1],
        'domain_2_score': domain_sums[2],
        'domain_3_score': domain_sums[3],
        'domain_4_score': domain_sums[4],
        'domain_5_score': domain_sums[5],
        'domain_6_score': domain_sums[6],
        'resilience_score': domain_sums[1],
        'safety_score': domain_sums[2],
        'policies_score': domain_sums[3],
        'leadership_score': domain_sums[4],
        'routine_practices_score': domain_sums[5],
        'evaluation_score': domain_sums[6],
        'total_score': total,
    }

# ----- Main -----

def main():
    out = []
    out.append('-- Demo seed data for Demo 2026 STS-BSC Collaborative\n')

    team_rows = []
    team_ids_by_name = {}
    for t in TEAMS:
        tid = rand_uuid()
        team_ids_by_name[t['team_name']] = tid
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

    for stmt in emit_insert(
        'teams',
        ['id', 'collaborative_id', 'agency_name', 'team_name', 'team_motto', 'estimated_staff_count', 'display_name', 'motto'],
        team_rows,
    ):
        out.append(stmt)

    # Team codes (12 = 3 teams × 4 timepoints)
    code_rows = []
    code_ids = {}  # (team_name, tp) -> code_id
    for t in TEAMS:
        for tp in TP_ORDER:
            cid = rand_uuid()
            code_ids[(t['team_name'], tp)] = cid
            _, end_date = TP_WINDOWS[tp]
            code_rows.append({
                'id': cid,
                'team_id': team_ids_by_name[t['team_name']],
                'code': rand_code(),
                'timepoint': tp,
                'active': True,
                'expires_at': dt.datetime.combine(end_date, dt.time(23, 59, 59)).isoformat(),
            })
    for stmt in emit_insert(
        'team_codes',
        ['id', 'team_id', 'code', 'timepoint', 'active', 'expires_at'],
        code_rows,
    ):
        out.append(stmt)

    # Per (team, timepoint): generate AR + child rows
    ar_rows = []
    demo_rows = []
    stss_rows = []
    proqol_rows = []
    stsioa_rows = []

    for t in TEAMS:
        for tp in TP_ORDER:
            n = t['n_per_tp'][tp]
            tc_id = code_ids[(t['team_name'], tp)]
            for _ in range(n):
                ar_id = rand_uuid()
                started = rand_date_in_window(tp)
                # completed within 0-3 days after started
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
                demo_rows.append(gen_demographics(ar_id))
                stss_rows.append(gen_stss(ar_id, t['profile'], tp))
                proqol_rows.append(gen_proqol(ar_id, t['profile'], tp))
                stsioa_rows.append(gen_stsioa(ar_id, t['profile'], tp))

    # Emit inserts in dependency order
    for stmt in emit_insert(
        'assessment_responses',
        ['id', 'team_code_id', 'timepoint', 'started_at', 'completed_at', 'is_complete',
         'demographics_complete', 'stss_complete', 'proqol_complete', 'stsioa_complete', 'tic_osa_complete', 'program_type'],
        ar_rows,
        batch_size=200,
    ):
        out.append(stmt)

    for stmt in emit_insert(
        'demographics',
        ['id', 'assessment_response_id', 'gender', 'age', 'age_over_65', 'years_in_service',
         'years_over_30', 'job_role', 'job_role_other', 'areas_of_responsibility', 'exposure_level'],
        demo_rows,
        batch_size=200,
    ):
        out.append(stmt)

    stss_cols = ['id', 'assessment_response_id'] + [f'item_{i}' for i in range(1, 18)] + \
                ['intrusion_score', 'avoidance_score', 'arousal_score', 'total_score']
    for stmt in emit_insert('stss_responses', stss_cols, stss_rows, batch_size=150):
        out.append(stmt)

    proqol_cols = ['id', 'assessment_response_id'] + [f'item_{i}' for i in range(1, 31)] + \
                  ['compassion_satisfaction_score', 'burnout_score', 'secondary_trauma_score']
    for stmt in emit_insert('proqol_responses', proqol_cols, proqol_rows, batch_size=100):
        out.append(stmt)

    stsioa_cols = ['id', 'assessment_response_id'] + [f'item_{iid}' for iid in STSIOA_ITEM_IDS] + \
                  ['domain_1_score', 'domain_2_score', 'domain_3_score', 'domain_4_score',
                   'domain_5_score', 'domain_6_score', 'resilience_score', 'safety_score',
                   'policies_score', 'leadership_score', 'routine_practices_score', 'evaluation_score', 'total_score']
    for stmt in emit_insert('stsioa_responses', stsioa_cols, stsioa_rows, batch_size=100):
        out.append(stmt)

    sys.stdout.write(''.join(out))


if __name__ == '__main__':
    main()
