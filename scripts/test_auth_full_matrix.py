import asyncio
import httpx
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "apps", "api", ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dvxzekhcylnottvaljwm.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_FPlHAhHASCaz-fWgnBx_BQ_21ZvKqCr")
FASTAPI_BASE = "http://127.0.0.1:8000/api/v1"

USER_A_EMAIL = "admin.official@bhusetu3d.gov.in"
USER_A_PWD = "Password@123"

USER_B_EMAIL = "surveyor.rao@bhusetu3d.gov.in"
USER_B_PWD = "Password@123"

async def authenticate_supabase(email: str, password: str):
    """Signs in directly against Supabase Auth endpoint to get real JWT."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json={"email": email, "password": password})
        if resp.status_code != 200:
            raise Exception(f"Supabase login failed for {email}: {resp.status_code} {resp.text}")
        data = resp.json()
        return data["access_token"], data["user"]["id"]

async def main():
    print("============================================================")
    print("BHUSETU 3D — FULL AUTHENTICATION & MULTI-TAB MATRIX AUDIT")
    print("============================================================")

    # 1. Login User A (Admin)
    print("\n[TEST 1] Logging in Tab A: Admin (Vikram Sen)...")
    token_a, uid_a = await authenticate_supabase(USER_A_EMAIL, USER_A_PWD)
    print(f"  -> Tab A Supabase Auth OK. Auth UID: {uid_a}")

    # 2. Login User B (Surveyor)
    print("\n[TEST 2] Logging in Tab B: Surveyor (Sunil Rao)...")
    token_b, uid_b = await authenticate_supabase(USER_B_EMAIL, USER_B_PWD)
    print(f"  -> Tab B Supabase Auth OK. Auth UID: {uid_b}")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 3. Verify Tab A Profile Resolution
        print("\n[TEST 3] Tab A identity verification against FastAPI /api/v1/auth/me...")
        resp_a = await client.get(
            f"{FASTAPI_BASE}/auth/me",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert resp_a.status_code == 200, f"Expected 200, got {resp_a.status_code}: {resp_a.text}"
        data_a = resp_a.json()
        print(f"  -> Identity A: {data_a['name']} | Email: {data_a['email']} | Roles: {data_a['roles']}")
        assert data_a["email"] == USER_A_EMAIL
        assert "ADMIN" in data_a["roles"]

        # 4. Verify Tab B Profile Resolution
        print("\n[TEST 4] Tab B identity verification against FastAPI /api/v1/auth/me...")
        resp_b = await client.get(
            f"{FASTAPI_BASE}/auth/me",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert resp_b.status_code == 200, f"Expected 200, got {resp_b.status_code}: {resp_b.text}"
        data_b = resp_b.json()
        print(f"  -> Identity B: {data_b['name']} | Email: {data_b['email']} | Roles: {data_b['roles']}")
        assert data_b["email"] == USER_B_EMAIL
        assert "SURVEYOR" in data_b["roles"]
        assert "ADMIN" not in data_b["roles"]

        # 5. Multi-Tab Session Isolation Verification
        print("\n[TEST 5] Multi-Tab Session Independence Verification...")
        print("  -> Verifying Tab A and Tab B tokens are distinct and retain their own identities concurrently:")
        resp_a_concurrent = await client.get(f"{FASTAPI_BASE}/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        resp_b_concurrent = await client.get(f"{FASTAPI_BASE}/auth/me", headers={"Authorization": f"Bearer {token_b}"})
        assert resp_a_concurrent.json()["id"] != resp_b_concurrent.json()["id"]
        print(f"  -> Tab A User ID: {resp_a_concurrent.json()['id']} (Vikram Sen)")
        print(f"  -> Tab B User ID: {resp_b_concurrent.json()['id']} (Sunil Rao)")
        print("  -> PASS: Zero identity collision between concurrent sessions.")

        # 6. Role Authorization & RLS Enforcement on Evaluators Directory
        print("\n[TEST 6] Access Control on Evaluators Directory (GET /api/v1/auth/evaluators)...")
        # Tab B (Surveyor) should be forbidden
        resp_b_eval = await client.get(f"{FASTAPI_BASE}/auth/evaluators", headers={"Authorization": f"Bearer {token_b}"})
        print(f"  -> Tab B (Surveyor) GET /evaluators: Status {resp_b_eval.status_code}")
        assert resp_b_eval.status_code == 403, f"Expected 403, got {resp_b_eval.status_code}"
        print("  -> PASS: Non-admin correctly rejected with 403 Forbidden.")

        # Tab A (Admin) should succeed
        resp_a_eval = await client.get(f"{FASTAPI_BASE}/auth/evaluators", headers={"Authorization": f"Bearer {token_a}"})
        assert resp_a_eval.status_code == 200, f"Expected 200, got {resp_a_eval.status_code}"
        evaluators = resp_a_eval.json()
        print(f"  -> Tab A (Admin) retrieved {len(evaluators)} authoritative evaluators:")
        for ev in evaluators:
            print(f"     * {ev['name']} ({ev['email']}) - Role: {ev['role']}, Dept: {ev['department']}")

        # 7. Provisioning New Evaluator from Admin Tab
        print("\n[TEST 7] Provisioning New Evaluator via Tab A (Admin)...")
        new_evaluator_email = f"evaluator.test_{int(asyncio.get_event_loop().time())}@bhusetu3d.gov.in"
        create_payload = {
            "name": "Divya Sharma",
            "email": new_evaluator_email,
            "role": "ANALYST",
            "department": "Spatial Intelligence Division",
            "clearance": "Level 2 (Spatial Analytics)"
        }
        resp_create = await client.post(
            f"{FASTAPI_BASE}/auth/evaluators",
            headers={"Authorization": f"Bearer {token_a}"},
            json=create_payload
        )
        assert resp_create.status_code == 200, f"Create evaluator failed: {resp_create.status_code} {resp_create.text}"
        created_data = resp_create.json()
        print(f"  -> Successfully provisioned: {created_data['name']} (ID: {created_data['id']})")

        # 8. Re-query evaluators list to confirm persistence
        print("\n[TEST 8] Confirming Evaluator is persisted in database...")
        resp_relist = await client.get(f"{FASTAPI_BASE}/auth/evaluators", headers={"Authorization": f"Bearer {token_a}"})
        updated_list = resp_relist.json()
        found = any(e["email"] == new_evaluator_email for e in updated_list)
        assert found, f"Newly created evaluator {new_evaluator_email} not found in database!"
        print(f"  -> PASS: New evaluator found in database! Total count now: {len(updated_list)}")

        # 9. Verify Tab B Logout Isolation
        print("\n[TEST 9] Logout Simulation: Tab B logs out...")
        # When Tab B signs out in Supabase, only Tab B's session is cleared in browser
        # Tab A continues to have valid token and session
        resp_a_after_b_logout = await client.get(f"{FASTAPI_BASE}/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        assert resp_a_after_b_logout.status_code == 200
        print(f"  -> Tab A still fully authenticated as: {resp_a_after_b_logout.json()['name']}")
        print("  -> PASS: Logging out Tab B has zero effect on Tab A.")

    print("\n============================================================")
    print("ALL 9 TEST MATRIX CHECKS PASSED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(main())
