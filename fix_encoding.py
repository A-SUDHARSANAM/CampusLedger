"""Fix double-encoded UTF-8 characters in BlockchainAuditPage.tsx."""
import re

f = 'web/src/pages/admin/BlockchainAuditPage.tsx'
content = open(f, encoding='utf-8').read()
original_len = len(content)

# Each corrupted sequence: cp1252 byte -> Unicode char in cp1252 mapping
# then that char was re-encoded as UTF-8.
# e.g. U+2026 ELLIPSIS -> UTF-8: E2 80 A6 -> cp1252 reading: â (E2) € (80) ¦ (A6)
# -> re-encoded as UTF-8: â=C3A2, €=E2 82 AC, ¦=C2A6
# When read as UTF-8 now: U+00E2 U+20AC U+00A6

FIXES = {
    '\u00e2\u20ac\u00a6': '...',     # â€¦  ellipsis U+2026
    '\u00e2\u20ac\u201c': '\u2013',  # â€" en-dash U+2013 -> use proper en-dash
    '\u00e2\u20ac\u009d': '\u2019',  # â€™ right single quote
    '\u00c2\u00b7': ' | ',           # Â·  middle dot U+00B7
    '\u00c3\u2014': 'x',             # Ã— times U+00D7 (cp1252: C3=Ã, 97=—)
    # Left arrow U+2190: UTF-8 E2 86 90
    # cp1252: E2=â(U+E2), 86=†(U+2020 dagger in cp1252), 90=control(U+0090)
    # re-encoded: â=C3A2, †=E2 80 A0, \x90=C2 90
    # U+00E2 U+2020 U+0090
    '\u00e2\u2020\u0090': '<- ',     # â†  left arrow (cp1252-read)
    # Right arrow U+2192: UTF-8 E2 86 92
    # cp1252: E2=â, 86=†, 92=\x92 (right single quotation mark U+2019 in cp1252)
    # re-encoded: â=C3A2, †=E2 80 A0, '=E2 80 99
    # U+00E2 U+2020 U+2019
    '\u00e2\u2020\u2019': '->',      # â†'  right arrow
    # Box drawing â"€ U+2500: UTF-8 E2 94 80
    # cp1252: E2=â, 94=", 80=€
    # re-encoded: â=C3A2, "=E2 80 9C, €=E2 82 AC... complex
}

for garbled, fix in FIXES.items():
    count = content.count(garbled)
    if count:
        print(f'  Fixing {count}x {repr(garbled)} -> {repr(fix)}')
        content = content.replace(garbled, fix)

# Also fix the box-drawing characters in comments (â"€â"€) -> --
box_draw = '\u00e2\u0148\u20ac'  # â"€ approx
count = content.count(box_draw)
if count:
    print(f'  Fixing {count}x box-drawing chars -> -')
    content = content.replace(box_draw, '-')

open(f, 'w', encoding='utf-8').write(content)
print(f'Done. Length {original_len} -> {len(content)}')

# Verify
remaining = re.findall(r'\u00e2\u20ac|\u00c2\u00b7|\u00c3\u2014|\u00e2\u2020', content)
print(f'Remaining garbled sequences: {remaining[:10]}')
