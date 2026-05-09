with open('client/src/pages/partner-pairing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove any icon character before "Dismiss"
import re
content = re.sub(r'[\u2605\u2728\ud83d\udea8\u270f\u2013\s]*Dismiss', 'Dismiss', content)

with open('client/src/pages/partner-pairing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')
