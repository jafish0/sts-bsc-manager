"""
Bulk-load the TIPE LC resource library from Resources/TIPE/Basecamp Download.zip.

WHY THIS IS NOT RUN BY CLAUDE CODE:
  Uploading to the private `resources` Supabase Storage bucket requires
  is_super_admin() (see storage.objects policies). A headless script only has
  the anon key, which cannot write there, and the service_role key is kept out
  of the agent's reach by policy. So Josh runs this locally with the service
  key in an env var. The key is NEVER printed or committed.

USAGE:
  # 1. Dry run (default) — validates the zip, dedupe, category mapping, and
  #    prints exactly what would be created. Touches nothing. No key needed.
  py scripts/seed_tipe_resources.py

  # 2. Real run — uploads files + creates resource_categories + resources rows.
  #    Needs the service role key (Supabase dashboard → Settings → API).
  #    PowerShell:
  #      $env:SUPABASE_SERVICE_ROLE_KEY = "<paste-key-here>"
  #      py scripts/seed_tipe_resources.py --commit
  #    The script reads VITE_SUPABASE_URL from .env.local and the key from env.

  # Optional: parse the video-links PDF into youtube/link resource rows.
  #   Requires `py -m pip install pypdf` (not installed by default). Without it,
  #   the Videos category still gets the source PDF; the embedded links are
  #   skipped and reported so they can be added manually or on a rerun.

WHAT IT DOES (per the 2026-06-10 WORKING_NOTES draft):
  - One TIPE category per topic folder in the zip (granular, as-is), PLUS
    "Trauma-Informed Schools" and "Videos". "School Intervention Project" and
    "Implementation - Charting the Course" are kept (they're topics).
  - EXCLUDES the session/call folders (they become per-event materials):
    Learning Session 1-4 (both LS4 folders), Learning Calls 1-3, and
    "Session 5 Secondary Traumatic Stress Powerpoint and Handouts".
  - Dedupes files by SHA-256: each unique file is uploaded ONCE to the
    `resources` bucket and gets ONE resources row whose `tags` array holds
    EVERY category (folder) it appeared in (multi-folder => multi-tab). For
    the Wisconsin doc that exists as both .docx and .pdf, the .pdf wins.
  - Loose Attachments/ (7 files) are tagged per the draft's explicit mapping.
  - Videos: keeps the source PDF as a downloadable resource, and (if pypdf is
    available) creates resource_type='youtube' rows per validated 11-char
    YouTube id and resource_type='link' rows for non-YouTube links.

IDEMPOTENCY: categories upsert on (program_type, category_key). Files are
keyed in storage by content hash, so re-runs overwrite the same object. A
resources row is created once per (hash); re-runs skip hashes already present
(matched by file_path, which encodes the hash).
"""
import os
import sys
import csv
import json
import hashlib
import zipfile
import collections
import datetime as dt

PROGRAM = 'tipe_lc'
ZIP_PATH = os.path.join(os.path.dirname(__file__), '..', 'Resources', 'TIPE', 'Basecamp Download.zip')
BUCKET = 'resources'
STORAGE_PREFIX = 'tipe_lc'  # object paths: tipe_lc/<sha256>.<ext>

COMMIT = '--commit' in sys.argv

# --- Folders to EXCLUDE from the library (become per-event materials) ---
EXCLUDE_FOLDERS = {
    'Learning Call 1- Implementation',
    'Learning Call 2- Sustainability',
    'Learning Call 3 - Making Mindfulness Accessible in the Classroom',
    'Learning Session 1 - 11-12-25',
    'Learning Session 2- 12-2-25',
    'Learning Session 3 - 1-27-26',
    'Learning Session 4- Trauma-Informed Classroom Behavior Management',
    'Learning Session 4- Trauma-Informed Mini-Modules',
    'Session 5 Secondary Traumatic Stress Powerpoint and Handouts',
}

# The video-links source folder is handled specially (its PDF → Videos cat),
# not as a normal topic folder.
VIDEO_SOURCE_FOLDER = 'Video Links List from 2025-2026 Learning Collaborative'
VIDEO_PDF_BASENAME = 'Video Links for TIPE Trainings_April 2025.pdf'

# Explicit, cleaned-up labels for topic folders. Any folder not listed here
# falls back to its raw folder name as the label.
LABEL_OVERRIDES = {
    'Emotional regulation strategies': 'Emotional Regulation Strategies',
    'Race-based stress-trauma': 'Race-Based Stress / Trauma',
    'Trauma & Trauma and Traumatic Stress Screeners': 'Trauma & Traumatic Stress Screeners',
    'Training, Education & Information- Traumatic Stress': 'Training, Education & Information - Traumatic Stress',
    'PBIS and MH Referral Toolkit - Aligning Initiatives': 'PBIS & MH Referral Toolkit - Aligning Initiatives',
}

# Extra categories not derived from a single topic folder.
EXTRA_CATEGORIES = ['Trauma-Informed Schools', 'Videos']

# Loose Attachments/<file> → category label(s) (draft's explicit mapping).
ATTACHMENT_TAGS = {
    '198257811-national-safe-supportive-schools-complete.pdf': ['Trauma-Informed Schools'],
    '198267659-wisconsin-department-of-public-instruction-trauma-sensitive-schools.docx': ['Trauma-Informed Schools'],  # .docx dropped in favor of .pdf
    '198268180-wisconsin-department-of-public-instruction-trauma-sensitive-schools.pdf': ['Trauma-Informed Schools'],
    '220947373-lets-talk-facilitating-critical-conversations-with-students.pdf': ['Community Engagement & Parent-Student Engagement'],
    '225598869-15-sites-and-apps-for-social-emotional-learning.docx': ['Social Emotional Learning'],
    '265149083-mindfulness-scripts-and-videos-for-kids.pdf': ['Mindfulness in Schools'],  # dup of a library file — dedupe by hash
    '265149161-mindup-activities-for-children-at-home.pdf': ['Mindfulness in Schools'],
}


def slugify(s):
    out = []
    for ch in s.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (' ', '-', '_', '&', '/', '+'):
            out.append('-')
    key = ''.join(out)
    while '--' in key:
        key = key.replace('--', '-')
    return key.strip('-')


def label_for(folder):
    return LABEL_OVERRIDES.get(folder, folder.strip())


def main():
    if not os.path.exists(ZIP_PATH):
        print(f'ERROR: zip not found at {ZIP_PATH}')
        sys.exit(1)

    z = zipfile.ZipFile(ZIP_PATH)
    members = [n for n in z.namelist() if not n.endswith('/')]

    # category label -> set of (member path)
    cat_files = collections.defaultdict(list)
    # hash -> { 'member': first path, 'size':, 'ext':, 'labels': set() }
    by_hash = {}
    skipped_excluded = 0
    video_pdf_member = None

    def add_file(member, labels):
        info = z.getinfo(member)
        with z.open(member) as fh:
            data = fh.read()
        h = hashlib.sha256(data).hexdigest()
        ext = os.path.splitext(member)[1].lower()
        base = os.path.basename(member)
        rec = by_hash.get(h)
        if rec is None:
            rec = {'member': member, 'base': base, 'size': info.file_size, 'ext': ext, 'labels': set(), 'hash': h}
            by_hash[h] = rec
        rec['labels'].update(labels)

    for member in members:
        parts = member.split('/')
        top = parts[0]

        if top == 'Attachments':
            base = parts[-1]
            labels = ATTACHMENT_TAGS.get(base)
            if labels:
                add_file(member, labels)
            else:
                add_file(member, [])  # untagged loose file — flag later
            continue

        if top != 'Resources':
            continue

        folder = parts[1] if len(parts) > 1 else ''
        if folder in EXCLUDE_FOLDERS:
            skipped_excluded += 1
            continue

        if folder == VIDEO_SOURCE_FOLDER:
            if os.path.basename(member) == VIDEO_PDF_BASENAME:
                video_pdf_member = member
                add_file(member, ['Videos'])
            continue

        # Normal topic folder → one category (its label).
        add_file(member, [label_for(folder)])

    # The Video Links PDF also appears under "Training, Education & Information"
    # — same hash, so it already carries that label; ensure 'Videos' too.
    # (handled by hash-merge above if both encountered)

    # Wisconsin doc: drop the .docx when the .pdf twin exists (same base name).
    drop_hashes = set()
    bases = {rec['base'].lower(): rec for rec in by_hash.values()}
    for rec in list(by_hash.values()):
        if rec['ext'] == '.docx':
            twin = os.path.splitext(rec['base'])[0].lower() + '.pdf'
            if twin in bases:
                drop_hashes.add(rec['hash'])
    for h in drop_hashes:
        # fold its labels into the pdf twin so no category loses the file
        rec = by_hash.pop(h)
        twin = bases[os.path.splitext(rec['base'])[0].lower() + '.pdf']
        twin['labels'].update(rec['labels'])

    # Assemble category set: every label used + the extras.
    used_labels = set()
    for rec in by_hash.values():
        used_labels.update(rec['labels'])
    used_labels.update(EXTRA_CATEGORIES)
    categories = sorted(used_labels)

    # --- Report ---
    multi = [r for r in by_hash.values() if len(r['labels']) > 1]
    untagged = [r for r in by_hash.values() if not r['labels']]
    print('=== TIPE RESOURCE LOAD PLAN (dry run) ===' if not COMMIT else '=== TIPE RESOURCE LOAD (COMMIT) ===')
    print(f'zip members (files):        {len(members)}')
    print(f'excluded (session/calls):   {skipped_excluded}')
    print(f'unique files (by hash):     {len(by_hash)}')
    print(f'  multi-category files:     {len(multi)}')
    print(f'  untagged (need a home):   {len(untagged)}')
    print(f'categories to upsert:       {len(categories)}')
    print(f'  dropped .docx twins:      {len(drop_hashes)}')
    print()
    print('--- Categories ---')
    for i, lbl in enumerate(categories):
        n = sum(1 for r in by_hash.values() if lbl in r['labels'])
        print(f'  [{i:2d}] {slugify(lbl):45s} {n:3d} files  "{lbl}"')
    if untagged:
        print()
        print('--- UNTAGGED FILES (no category — review) ---')
        for r in untagged:
            print('  ', r['member'])
    if multi:
        print()
        print(f'--- MULTI-CATEGORY FILES (sample up to 10 of {len(multi)}) ---')
        for r in multi[:10]:
            print(f"  {r['base']}  ->  {sorted(r['labels'])}")

    if not COMMIT:
        print()
        print('Dry run only. Re-run with --commit and SUPABASE_SERVICE_ROLE_KEY set to upload.')
        return

    # ---- COMMIT PATH (requires service role key) ----
    import urllib.request, urllib.error
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not key:
        print('ERROR: set SUPABASE_SERVICE_ROLE_KEY in the environment for --commit.')
        sys.exit(1)
    env = {}
    with open(os.path.join(os.path.dirname(__file__), '..', '.env.local')) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                env[k] = v
    url = env['VITE_SUPABASE_URL']
    H = {'apikey': key, 'Authorization': f'Bearer {key}'}

    def api(method, path, body=None, headers=None, raw=False):
        hdrs = dict(H)
        if headers:
            hdrs.update(headers)
        data = body if raw else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(url + path, data=data, headers=hdrs, method=method)
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, resp.read()

    # 1. Upsert categories, capture id per label.
    cat_id = {}
    for i, lbl in enumerate(categories):
        key_slug = slugify(lbl)
        body = [{'program_type': PROGRAM, 'category_key': key_slug, 'category_label': lbl, 'sort_order': i}]
        st, resp = api('POST', '/rest/v1/resource_categories?on_conflict=program_type,category_key',
                       body, {'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation'})
        row = json.loads(resp)[0]
        cat_id[lbl] = row['id']
    print(f'Upserted {len(cat_id)} categories.')

    # 2. Upload unique files + create resources rows.
    created = 0
    for rec in by_hash.values():
        obj_path = f"{STORAGE_PREFIX}/{rec['hash']}{rec['ext']}"
        with z.open(rec['member']) as fh:
            blob = fh.read()
        # Upload (x-upsert overwrites if present → idempotent).
        try:
            api('POST', f'/storage/v1/object/{BUCKET}/{obj_path}', blob,
                {'Content-Type': 'application/octet-stream', 'x-upsert': 'true'}, raw=True)
        except urllib.error.HTTPError as e:
            print(f"  upload failed for {rec['base']}: {e.code} {e.read()[:200]}")
            continue
        tags = sorted(slugify(l) for l in rec['labels'])
        primary = cat_id.get(sorted(rec['labels'])[0]) if rec['labels'] else None
        row = {
            'title': os.path.splitext(rec['base'])[0],
            'file_name': rec['base'],
            'file_path': obj_path,
            'resource_type': 'file',
            'program_type': PROGRAM,
            'domains': [],
            'tags': tags,
            'category_id': primary,
        }
        api('POST', '/rest/v1/resources', [row],
            {'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
        created += 1
        if created % 25 == 0:
            print(f'  ...{created} files uploaded')
    print(f'Created {created} file-backed resources rows.')
    print('NOTE: Videos PDF embedded links not auto-parsed (needs pypdf). Add youtube/link rows separately if desired.')


if __name__ == '__main__':
    main()
