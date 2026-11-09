import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv("apps/api/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dvxzekhcylnottvaljwm.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_FPlHAhHASCaz-fWgnBx_BQ_21ZvKqCr")
FASTAPI_BASE = "http://127.0.0.1:8000/api/v1"

PERSONAS = [
    {"name": "Vikram Sen", "email": "admin.official@bhusetu3d.gov.in", "role": "ADMIN"},
    {"name": "Kavita Sharma", "email": "officer.kavita@bhusetu3d.gov.in", "role": "GOVERNMENT_OFFICER"},
    {"name": "Sunil Rao", "email": "surveyor.rao@bhusetu3d.gov.in", "role": "SURVEYOR"},
    {"name": "Priya Nair", "email": "analyst.priya@bhusetu3d.gov.in", "role": "ANALYST"},
]

async def safe_post(client, url, **kwargs):
    for i in range(4):
        try:
            return await client.post(url, **kwargs)
        except (httpx.ConnectError, httpx.ReadTimeout):
            if i < 3:
                await asyncio.sleep(1.0)
            else:
                raise

async def safe_get(client, url, **kwargs):
    for i in range(4):
        try:
            return await client.get(url, **kwargs)
        except (httpx.ConnectError, httpx.ReadTimeout):
            if i < 3:
                await asyncio.sleep(1.0)
            else:
                raise

async def test_persona(p):
    print(f"\n--- Testing Persona: {p['name']} ({p['email']}) ---")
    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Supabase Auth Login
        login_resp = await safe_post(
            client,
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": p["email"], "password": "Password@123"}
        )
        assert login_resp.status_code == 200, f"Supabase login failed for {p['email']}: {login_resp.text}"
        token = login_resp.json()["access_token"]
        print(f"  [1] Supabase Auth Login: OK (HTTP {login_resp.status_code})")

        # 2. Supabase PostgREST Query (the query from the user screenshot)
        rest_url = f"{SUPABASE_URL}/rest/v1/users?select=id,email,full_name,role,department,is_active"
        rest_resp = await safe_get(
            client,
            rest_url,
            headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
        )
        assert rest_resp.status_code == 200, f"PostgREST query failed for {p['email']}: {rest_resp.status_code} {rest_resp.text}"
        records = rest_resp.json()
        print(f"  [2] PostgREST RLS Query: OK (HTTP {rest_resp.status_code}) - Returned {len(records)} record(s)")
        for r in records:
            if r["email"].lower() == p["email"].lower():
                print(f"      Matched user: {r['full_name']} | Role: {r['role']}")

        # 3. FastAPI /api/v1/auth/me
        me_resp = await safe_get(
            client,
            f"{FASTAPI_BASE}/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200, f"FastAPI /me failed for {p['email']}: {me_resp.status_code} {me_resp.text}"
        me_data = me_resp.json()
        print(f"  [3] FastAPI /auth/me: OK (HTTP {me_resp.status_code}) - Name: {me_data['name']} | Roles: {me_data['roles']}")
        assert p["role"] in me_data["roles"]

async def main():
    print("============================================================")
    print("VERIFYING ALL 4 1-CLICK EVALUATOR PERSONAS POST-RLS-FIX")
    print("============================================================")
    for p in PERSONAS:
        await test_persona(p)
        await asyncio.sleep(0.5)
    print("\n============================================================")
    print("ALL 4 EVALUATOR PERSONAS PASSED WITH ZERO RLS RECURSION ERROR!")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(main())
