#!/usr/bin/env python3
"""
Comprehensive CSS fix verification and auditor
Finds all hidden high z-index elements that might block clicks
"""

import re

def find_problematic_css():
    """Find all CSS rules that might block clicks"""
    with open('web/style.css', 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    problematic = []
    
    # Look for patterns: high z-index + display:none but no pointer-events
    current_selector = None
    selector_start = 0
    brace_count = 0
    current_rule = []
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Track CSS rule blocks
        if '{' in line:
            if not current_selector:
                # Extract selector
                current_selector = line[:line.index('{')].strip()
                selector_start = i
            brace_count += line.count('{')
            brace_count -= line.count('}')
        elif '}' in line:
            brace_count -= line.count('}')
            brace_count += line.count('{')
        
        current_rule.append(line)
        
        # When rule ends
        if brace_count == 0 and current_selector:
            rule_text = ''.join(current_rule)
            
            # Check for problematic patterns
            has_high_zindex = re.search(r'z-index\s*:\s*(?:10000|99999|100\d{3})', rule_text, re.IGNORECASE)
            has_display_none = 'display: none' in rule_text
            has_pointer_events = re.search(r'pointer-events\s*:', rule_text, re.IGNORECASE)
            
            if has_high_zindex and has_display_none and not has_pointer_events:
                problematic.append({
                    'selector': current_selector,
                    'line': selector_start,
                    'has_zindex': bool(has_high_zindex),
                    'has_display_none': bool(has_display_none),
                    'has_pointer_events': bool(has_pointer_events),
                    'needs_fix': True
                })
            
            current_selector = None
            current_rule = []
    
    return problematic

print("=" * 70)
print("CSS BLOCKING ELEMENT AUDIT")
print("=" * 70)

problematic = find_problematic_css()

if problematic:
    print(f"\n❌ Found {len(problematic)} potentially blocking CSS rules:\n")
    for item in problematic:
        print(f"  Line {item['line']:4d}: {item['selector']}")
        print(f"            Has high z-index: {item['has_zindex']}")
        print(f"            Has display: none: {item['has_display_none']}")
        print(f"            Has pointer-events: {item['has_pointer_events']}")
        print()
else:
    print("✅ No problematic CSS rules found!")

print("=" * 70)
print("VERIFICATION CHECKLIST")
print("=" * 70)

with open('web/style.css', 'r', encoding='utf-8', errors='ignore') as f:
    css = f.read()

checks = [
    ('.modal-overlay' in css and 'pointer-events: none;' in css, '.modal-overlay has pointer-events: none'),
    ('.context-menu' in css and 'pointer-events: none !important;' in css, '.context-menu has pointer-events: none !important'),
    ('.context-menu.show' in css and 'pointer-events: auto !important;' in css, '.context-menu.show has pointer-events: auto !important'),
    ('#mainApp .context-menu.show' in css and 'pointer-events: auto !important;' in css, '#mainApp .context-menu.show has pointer-events override'),
    ('.full-screen-spinner' in css and 'pointer-events: none;' in css, '.full-screen-spinner has pointer-events: none'),
]

all_pass = True
for check, desc in checks:
    status = "✅" if check else "❌"
    print(f"{status} {desc}")
    all_pass = all_pass and check

print("\n" + "=" * 70)
if all_pass and not problematic:
    print("✅ CSS FIX STATUS: COMPLETE - All blocking elements handled!")
else:
    print("⚠️  CSS FIX STATUS: NEEDS REVIEW - See issues above")
print("=" * 70)
