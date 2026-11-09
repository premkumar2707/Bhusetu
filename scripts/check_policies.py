import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "apps", "api", ".env"))
url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

async def main():
    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    rows = await conn.fetch("""
        SELECT polname, polcmd, polpermissive, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as with_check
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        WHERE cls.relname = 'users';
    """)
    print(f"Total policies on public.users: {len(rows)}")
    for r in rows:
        print(f"Policy: {r['polname']} (Cmd: {r['polcmd']})")
        print(f"  USING: {r['qual']}")
        print(f"  WITH CHECK: {r['with_check']}")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
