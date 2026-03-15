import time
import urllib.request
import email.utils
import datetime

# Monkeypatch time.time to account for system clock skew
def get_offset():
    try:
        req = urllib.request.Request('https://www.google.com', method='HEAD')
        with urllib.request.urlopen(req, timeout=5) as response:
            remote_date = response.info()['Date']
            remote_dt = email.utils.parsedate_to_datetime(remote_date)
            remote_ts = remote_dt.timestamp()
            local_ts = time.time()
            return remote_ts - local_ts
    except Exception as e:
        print(f"Warning: Could not get time offset from Google: {e}")
        return 0

OFFSET = get_offset()
print(f"System time offset: {OFFSET} seconds")

# Monkeypatch time
_original_time = time.time
def synced_time():
    return _original_time() + OFFSET
time.time = synced_time

# Monkeypatch datetime
class SyncedDateTime(datetime.datetime):
    @classmethod
    def now(cls, tz=None):
        return super(SyncedDateTime, cls).fromtimestamp(time.time(), tz)
    @classmethod
    def utcnow(cls):
        return super(SyncedDateTime, cls).fromtimestamp(time.time(), datetime.timezone.utc)

datetime.datetime = SyncedDateTime

# Now import the rest
import firebase_admin
from firebase_admin import credentials, firestore
import csv

def init_and_sync():
    print("Script started...")
    # Initialize Firebase
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    cred_path = os.path.join(current_dir, 'firebase-key.json')
    cred = credentials.Certificate(cred_path)
    print("Credential loaded.")
    
    firebase_admin.initialize_app(cred)
    print("App initialized.")
    db = firestore.client()

    print("Connecting to Firestore...")

    # 1. Auto-Collection Setup (Requirement 1)
    collections_to_init = ['guests', 'orders', 'billing', 'ledger']
    print("Initializing collections...")
    for coll in collections_to_init:
        # Create an initialization markers document if it doesn't exist
        doc_ref = db.collection(coll).document('_init_')
        if not doc_ref.get().exists:
            doc_ref.set({
                'created_at': firestore.SERVER_TIMESTAMP,
                'status': 'initialized',
                'project': 'Barak Residency'
            })
            print(f"Collection '{coll}' initialized with marker.")
        else:
            print(f"Collection '{coll}' already exists.")

    # 2. CSV-to-Cloud Force Push (Requirement 2)
    menu_items = []
    try:
        menu_path = os.path.join(os.path.dirname(current_dir), 'menu.csv')
        with open(menu_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                item = {
                    'id': row['id'].strip(),
                    'name': row['name'].strip(),
                    'price': float(row['price']),
                    'category': row['category'].strip(),
                    'icon': row['icon'].strip(),
                    'description': row['description'].strip(),
                    'photo': row.get('photo', '').strip() if row.get('photo') else '',
                    'isAvailable': True, # Requirement 2 default
                    'last_updated': firestore.SERVER_TIMESTAMP
                }
                menu_items.append(item)
    except Exception as e:
        print(f"Error reading menu.csv: {e}")
        return

    print(f"Parsed {len(menu_items)} items from menu.csv")

    # Sync to Firestore 'menuItems' (Requirement 2)
    collection_name = 'menuItems'
    batch = db.batch()
    for item in menu_items:
        doc_id = item['id']
        doc_ref = db.collection(collection_name).document(doc_id)
        batch.set(doc_ref, item)
        print(f"Prepared: {doc_id} - {item['name']}")

    print("Committing batch...")
    try:
        batch.commit()
        print("Batch commit successful!")
    except Exception as e:
        print(f"Error committing batch: {e}")

    print("Cloud Infrastructure Automation Complete!")

if __name__ == "__main__":
    init_and_sync()
