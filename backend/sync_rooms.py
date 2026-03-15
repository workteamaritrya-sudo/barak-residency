import firebase_admin
from firebase_admin import credentials, firestore
import time
import datetime
import requests

# --- Time Sync Monkeypatch ---
# This fixes the "Token must be a short-lived token" / "invalid_grant" error 
# caused by system clock skew on Windows.
def get_remote_time():
    try:
        # Use a reliable server time
        response = requests.head("https://www.google.com", timeout=5)
        date_str = response.headers.get("Date")
        if date_str:
            remote_time = email.utils.parsedate_to_datetime(date_str)
            return remote_time.timestamp()
    except Exception as e:
        print(f"Warning: Could not sync time with Google: {e}")
    return time.time()

import email.utils
remote_now = get_remote_time()
local_now = time.time()
offset = remote_now - local_now

print(f"Time Sync: Local={local_now}, Remote={remote_now}, Offset={offset}")

original_time = time.time
def synced_time():
    return original_time() + offset

time.time = synced_time

# Monkeypatch datetime for libraries that use datetime.now()
class SyncedDateTime(datetime.datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime.datetime.fromtimestamp(synced_time(), tz)

datetime.datetime = SyncedDateTime

# --- Firebase Initialization ---
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(current_dir, "firebase-key.json")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

def generate_rooms():
    rooms = []
    # 1st Floor (101-108)
    for i in range(1, 9):
        num = f"10{i}"
        rooms.append({"number": num, "floor": 1, "status": "available", "guest": None})
    
    # 2nd Floor (201-208)
    for i in range(1, 9):
        num = f"20{i}"
        rooms.append({"number": num, "floor": 2, "status": "available", "guest": None})
    return rooms

def sync_rooms():
    print("Pushing room data to Firestore 'rooms' collection...")
    batch = db.batch()
    rooms_ref = db.collection("rooms")
    
    rooms_data = generate_rooms()
    
    for room in rooms_data:
        doc_ref = rooms_ref.document(room["number"])
        batch.set(doc_ref, room)
        print(f"   [+] Queued Room {room['number']}")
        
    batch.commit()
    print("All rooms synced successfully!")

if __name__ == "__main__":
    sync_rooms()
