import sqlite3

DB = r'C:\Users\leela\.local\share\mimocode\mimocode.db'
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Search for user statements containing rules/decisions/preferences
print("=== USER STATEMENTS WITH RULES/DECISIONS (last 7 days) ===")
cur.execute("""
SELECT m.session_id, datetime(m.time_created/1000, 'unixepoch') as ts,
       substr(json_extract(p.data, '$.text'), 1, 300) as text
FROM message m
JOIN part p ON p.message_id = m.id
WHERE m.session_id IN (
    SELECT id FROM session 
    WHERE directory LIKE '%tinylink%' 
      AND time_created >= 1784563779961
      AND title NOT LIKE 'checkpoint-writer%'
)
AND json_extract(m.data, '$.role') = 'user'
AND json_extract(p.data, '$.type') = 'text'
AND (
    json_extract(p.data, '$.text') LIKE '%always%'
    OR json_extract(p.data, '$.text') LIKE '%never%'
    OR json_extract(p.data, '$.text') LIKE '%remember%'
    OR json_extract(p.data, '$.text') LIKE '%rule%'
    OR json_extract(p.data, '$.text') LIKE '%decision%'
    OR json_extract(p.data, '$.text') LIKE '%decided%'
    OR json_extract(p.data, '$.text') LIKE '%tradeoff%'
    OR json_extract(p.data, '$.text') LIKE '%workflow%'
    OR json_extract(p.data, '$.text') LIKE '%pattern%'
)
ORDER BY m.time_created DESC
LIMIT 30
""")
for r in cur.fetchall():
    print(f"{r['session_id']}  {r['ts']}  {r['text'][:200]}")

print()
print("=== ASSISTANT FILE WRITES/EDITS IN LAST 3 SESSIONS ===")
for sid in ['ses_05bf9a01effe24b7ndpodhh9lX', 'ses_06090a2cbffefOOwzBBvVC63rz', 'ses_06211b8a7ffeWWmJftIpgjN3sJ']:
    cur.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           json_extract(p.data, '$.state.input.file_path') as file_path
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
    AND json_extract(m.data, '$.role') = 'assistant'
    AND json_extract(p.data, '$.type') = 'tool'
    AND json_extract(p.data, '$.tool') IN ('write', 'edit')
    ORDER BY m.time_created
    """, (sid,))
    rows = cur.fetchall()
    print(f"\n--- {sid} ({len(rows)} file ops) ---")
    for r in rows:
        print(f"  {r['tool']}  {r['file_path']}")

print()
print("=== NEW SESSIONS NOT IN MEMORY (from DB, last 7 days) ===")
cur.execute("""
SELECT id, title, datetime(time_created/1000, 'unixepoch') as created
FROM session
WHERE directory LIKE '%tinylink%'
  AND time_created >= 1784563779961
  AND title NOT LIKE 'checkpoint-writer%'
  AND title != 'Auto Dream'
ORDER BY time_created DESC
""")
for r in cur.fetchall():
    title = (r['title'] or '(no title)')[:80]
    print(f"{r['id']}  {r['created']}  {title}")

conn.close()
