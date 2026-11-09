import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv("apps/api/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dvxzekhcylnottvaljwm.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_FPlHAhHASCaz-fWgnBx_BQ_21ZvKqCr")

async def login(email: str, password: str = "Password@123"):
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password}
        )
        assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
        return resp.json()["access_token"]

async def test_rest_query(token: str, user_label: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        url = f"{SUPABASE_URL}/rest/v1/users?select=id,email,full_name,role,department,is_active"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        resp = await client.get(url, headers=headers)
        print(f"\n[REST Query Test for {user_label}]")
        print(f"  URL: {url}")
        print(f"  HTTP Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  -> SUCCESS! Returned {len(data)} user record(s):")
            for u in data:
                print(f"     * {u['full_name']} ({u['email']}) - Role: {u['role']}")
        else:
            print(f"  -> FAILED: {resp.text}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

async def main():
    print("Testing Supabase PostgREST queries with non-recursive RLS policy...")

    # Test 1: Admin user (Vikram Sen) - should see all users
    token_admin = await login("admin.official@bhusetu3d.gov.in")
    await test_rest_query(token_admin, "Admin (Vikram Sen)")

    # Test 2: Government Officer (Kavita Sharma) - should see own profile without recursion
    token_officer = await login("officer.kavita@bhusetu3d.gov.in")
    await test_rest_query(token_officer, "Officer (Kavita Sharma)")

    # Test 3: Surveyor (Sunil Rao) - should see own profile without recursion
    token_surveyor = await login("surveyor.rao@bhusetu3d.gov.in")
    await test_rest_query(token_surveyor, "Surveyor (Sunil Rao)")

    print("\nALL POSTGREST REST /v1/users QUERIES PASSED WITH ZERO RECURSION ERROR!")

if __name__ == "__main__":
    asyncio.run(main())
