#!/usr/bin/env python3
import re

with open('client/src/pages/partner-pairing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the button section with correct text
# Find from "className="flex-1 rounded-lg"" for dismiss button
old_pattern = r'(\s+)\>\s*Dismiss\s*\<'
new_text = r'\1>Dismiss<'
content = re.sub(old_pattern, new_text, content, flags=re.MULTILINE)

with open('client/src/pages/partner-pairing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed Dismiss button!')
