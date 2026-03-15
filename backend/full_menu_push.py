import firebase_admin
from firebase_admin import credentials, firestore
import csv
import time
import datetime
import requests
import email.utils

# --- Time Sync Monkeypatch ---
def get_remote_time():
    try:
        response = requests.head("https://www.google.com", timeout=5)
        date_str = response.headers.get("Date")
        if date_str:
            remote_time = email.utils.parsedate_to_datetime(date_str)
            return remote_time.timestamp()
    except Exception as e:
        print(f"Warning: Could not sync time: {e}")
    return time.time()

remote_now = get_remote_time()
local_now = time.time()
offset = remote_now - local_now
time.time = lambda: datetime.datetime.now().timestamp() # Simplified for this script
original_time = time.time
time.time = lambda: original_time() + offset

# --- Firebase Initialization ---
cred = credentials.Certificate("e:/BR/firebase-key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def push_full_menu():
    print("Mission: Full Menu Push Starting...")
    menu_file = "e:/BR/menu.csv"
    
    with open(menu_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        batch = db.batch()
        menu_ref = db.collection("menu")
        
        count = 0
        for row in reader:
            # Clean numeric data
            row['price'] = float(row['price']) if row.get('price') else 0.0
            
            # Use 'id' as document ID
            doc_id = row.get('id')
            if not doc_id:
                print(f"Skipping row without ID: {row.get('name')}")
                continue
                
            doc_ref = menu_ref.document(doc_id)
            batch.set(doc_ref, row)
            count += 1
            print(f"   [+] Queued Item: {row.get('name')} ({doc_id})")
            
            # Commit in chunks of 400 for safety
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()

        batch.commit()
        print(f"Success: {count} menu items pushed to 'menu' collection.")

if __name__ == "__main__":
    push_full_menu()
