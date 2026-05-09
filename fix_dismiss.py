import re

with open('client/src/pages/partner-pairing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace {t('Dismiss')} with just Dismiss
content = content.replace("{t('Dismiss')}", 'Dismiss')

with open('client/src/pages/partner-pairing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')
