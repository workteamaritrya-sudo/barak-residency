import os
import re

for r, _, fs in os.walk('.'):
    if '.gemini' in r or '.git' in r:
        continue
    for f in fs:
        if f.endswith(('.html', '.js', '.css')):
            path = os.path.join(r, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
            except UnicodeDecodeError:
                # Fallback to pure bytes replacement if truly corrupted, but we reset git so it should be utf-8
                print(f"Skipped {path} due to decode error")
                continue
            
            original_content = content

            # Sub the symbols
            content = re.sub(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u2300-\u23ff\u2500-\u25ff\u2b00-\u2bff]', '', content)
            
            # Add favicon if it's an HTML file
            if f.endswith('.html') and '<link rel="icon"' not in content:
                content = content.replace('</head>', '    <link rel="icon" href="br.png" type="image/png">\n</head>')

            # Specifically update initialize.html for BR-STK-001
            if f == 'initialize.html':
                if 'BR-STK-001' not in content:
                    content = content.replace(
                        '- Rest Desk: BR-RD-001  | restdesk@barak.com\n- Password for all staff: password123',
                        '- Rest Desk: BR-RD-001  | restdesk@barak.com\n- Stock:     BR-STK-001 | stock@barak.com\n- Password for all staff: password123'
                    )
                    content = content.replace(
                        "{ empId: 'BR-RD-001', assignedEmail: 'restdesk@barak.com', name: 'Rest Desk', role: 'RestDesk' }\n                ];",
                        "{ empId: 'BR-RD-001', assignedEmail: 'restdesk@barak.com', name: 'Rest Desk', role: 'RestDesk' },\n                    { empId: 'BR-STK-001', assignedEmail: 'stock@barak.com', name: 'Stock Manager', role: 'Stock' }\n                ];"
                    )

            if content != original_content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
                print(f"Processed {path}")
