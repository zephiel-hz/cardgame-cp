with open('client/src/pages/partner-pairing.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and fix the line with the icon
for i, line in enumerate(lines):
    if 'Dismiss' in line and line.strip().startswith('Dismiss') == False:
        # Extract the spaces before the text
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]
        # Replace the whole line with just indent + Dismiss
        lines[i] = indent + 'Dismiss\n'
        print(f"Fixed line {i+1}")

with open('client/src/pages/partner-pairing.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done!')
