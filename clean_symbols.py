import os
import re

for r, _, fs in os.walk('.'):
    if '.gemini' in r or '.git' in r:
        continue
    for f in fs:
        if f.endswith(('.html', '.js', '.css')):
            path = os.path.join(r, f)
            try:
                # Use errors='replace' to ignore bad bytes
                with open(path, 'r', encoding='utf-8', errors='replace') as file:
                    content = file.read()
            except Exception as e:
                print(f"Skipping {path} due to error: {e}")
                continue
            
            # Sub the symbols
            new_content = re.sub(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u2300-\u23ff\u2500-\u25ff\u2b00-\u2bff]', '', content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"Cleaned {path}")
