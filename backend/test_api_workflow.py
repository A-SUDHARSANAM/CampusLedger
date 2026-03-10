import sys
import uuid
from app.db.supabase import supabase_admin

def run_test():
    print("--- Starting Full Maintenance Workflow Test ---")
    
    # 1. Create a mock user for each role
    print("\n[1] Setting up mock users and asset...")
    admin_id = str(uuid.uuid4())
    tech_id = str(uuid.uuid4())
    staff_id = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())
    
    admin_role = 'affb5e13-47c1-4466-a1f6-1d8f0c7fd0c2'
    tech_role = 'e3479a81-b823-4853-8d7e-a7b3bee371bd'
    staff_role = '9413c59d-296b-4308-9a03-a96a1cb5c3bf'
    
    supabase_admin.table("users").insert([
        {"id": admin_id, "email": f"admin_{admin_id}@test.com", "role_id": admin_role, "name": "Test Admin", "status": "active"},
        {"id": tech_id, "email": f"tech_{tech_id}@test.com", "role_id": tech_role, "name": "Test Tech", "status": "active"},
        {"id": staff_id, "email": f"staff_{staff_id}@test.com", "role_id": staff_role, "name": "Test Staff", "status": "active"}
    ]).execute()
    
    supabase_admin.table("assets").insert({
        "id": asset_id,
        "asset_name": "Test Oscilloscope",
        "status": "under_maintenance"
    }).execute()
    
    # 2. Lab Technician Raises Issue
    print("\n[2] Lab Technician raises an issue...")
    res = supabase_admin.table("maintenance_requests").insert({
        "asset_id": asset_id,
        "reported_by": tech_id,
        "issue_description": "Screen is flickering",
        "priority": "high",
        "status": "pending_admin_review"
    }).execute()
    req_id = res.data[0]["id"]
    print(f"-> Created maintenance_request {req_id} with status: {res.data[0]['status']}")
    
    # 3. Admin Reviews & Assigns Task
    print("\n[3] Admin reviews and assigns task...")
    task_res = supabase_admin.table("service_tasks").insert({
        "issue_id": req_id,
        "asset_id": asset_id,
        "assigned_to": staff_id,
        "assigned_by": admin_id,
        "priority": "high",
        "status": "pending"
    }).execute()
    task_id = task_res.data[0]["id"]
    
    supabase_admin.table("maintenance_requests").update({"status": "assigned"}).eq("id", req_id).execute()
    
    req_check = supabase_admin.table("maintenance_requests").select("status").eq("id", req_id).execute()
    print(f"-> Created service_task {task_id}")
    print(f"-> maintenance_request status is now: {req_check.data[0]['status']}")
    
    # 4. Service Staff Starts Task
    print("\n[4] Service Staff starts repairing the asset...")
    supabase_admin.table("service_tasks").update({"status": "in_progress"}).eq("id", task_id).execute()
    task_check = supabase_admin.table("service_tasks").select("status").eq("id", task_id).execute()
    print(f"-> service_task status is now: {task_check.data[0]['status']}")
    
    # 5. Service Staff Completes Task
    print("\n[5] Service Staff marks task complete...")
    supabase_admin.table("service_tasks").update({"status": "completed"}).eq("id", task_id).execute()
    supabase_admin.table("maintenance_requests").update({"status": "completed"}).eq("id", req_id).execute()
    supabase_admin.table("assets").update({"status": "active"}).eq("id", asset_id).execute()
    
    task_final = supabase_admin.table("service_tasks").select("status").eq("id", task_id).execute()
    req_final = supabase_admin.table("maintenance_requests").select("status").eq("id", req_id).execute()
    asset_final = supabase_admin.table("assets").select("status").eq("id", asset_id).execute()
    
    print(f"-> Final service_task status: {task_final.data[0]['status']}")
    print(f"-> Final maintenance_request status: {req_final.data[0]['status']}")
    print(f"-> Final asset status: {asset_final.data[0]['status']}")

    print("\n--- Workflow Test Completed Successfully! ---")
    
if __name__ == "__main__":
    run_test()
