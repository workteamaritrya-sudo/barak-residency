import os
import re

def process():
    for r, _, fs in os.walk('.'):
        if '.gemini' in r or '.git' in r:
            continue
        for f in fs:
            if not f.endswith(('.html', '.js', '.css')):
                continue
            path = os.path.join(r, f)
            try:
                with open(path, 'r', encoding='utf-8', errors='replace') as file:
                    content = file.read()
            except Exception as e:
                print(f"Skipping {path}: {e}")
                continue
                
            original = content

            # Remove emojis and dingbats while preserving simple ASCII and Rupees
            content = re.sub(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u2500-\u25ff\u2b00-\u2bff]', '', content)

            # Insert favicon in properly encoded HTML
            if f.endswith('.html') and '<link rel="icon"' not in content:
                content = content.replace('</head>', '    <link rel="icon" href="br.png" type="image/png">\n</head>')

            # Update initialize.html specific logic
            if f == 'initialize.html':
                if 'BR-STK-001' not in content:
                    content = content.replace(
                        "- Rest Desk: BR-RD-001  | restdesk@barak.com\n- Password for all staff: password123",
                        "- Rest Desk: BR-RD-001  | restdesk@barak.com\n- Stock:     BR-STK-001 | stock@barak.com\n- Password for all staff: password123"
                    )
                    content = content.replace(
                        "{ empId: 'BR-RD-001', assignedEmail: 'restdesk@barak.com', name: 'Rest Desk', role: 'RestDesk' }",
                        "{ empId: 'BR-RD-001', assignedEmail: 'restdesk@barak.com', name: 'Rest Desk', role: 'RestDesk' },\n                    { empId: 'BR-STK-001', assignedEmail: 'stock@barak.com', name: 'Stock Manager', role: 'Stock' }"
                    )

            if content != original:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
                print(f"Updated {f}")

process()
