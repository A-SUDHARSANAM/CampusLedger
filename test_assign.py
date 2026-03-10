import urllib.request as r
import json

base = "http://localhost:8000/api/v1"

try:
    req = r.Request(f"{base}/auth/login", data=json.dumps({"email": "admin@campus.edu", "password": "password"}).encode('utf-8'), headers={"Content-Type": "application/json"})
    toks = json.loads(r.urlopen(req).read())
    token = toks["access_token"]
    user_id = toks["user"]["id"]
except Exception as e:
    print("Login Failed:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
    exit(1)

try:
  req2 = r.Request(f"{base}/tasks/assign", data=json.dumps({
      "issue_id": "REQ-1002",
      "asset_id": "asset-4",
      "assigned_to": "u-service-1", 
      "assigned_by": user_id,
      "priority": "medium"
  }).encode('utf-8'), headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
  print("Success:", r.urlopen(req2).read().decode())
except Exception as e:
  print("Assign Failure:", e)
  if hasattr(e, 'read'):
      print(e.read().decode())
