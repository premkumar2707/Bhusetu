import psycopg2
import os
from dotenv import load_dotenv

load_dotenv("apps/api/.env")
url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://").replace(":6543/", ":5432/")

def fix_rls():
    print("Connecting to Supabase PostgreSQL on port 5432...")
    conn = psycopg2.connect(url, sslmode="require")
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Inspect existing policies on public.users
    cur.execute("""
        SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        WHERE cls.relname = 'users';
    """)
    policies = cur.fetchall()
    print("\n[Current Policies on public.users]")
    for p in policies:
        print(f"  * {p[0]} (Cmd: {p[1]}): {p[2]}")

    # 2. Create SECURITY DEFINER helper function to bypass RLS recursion
    print("\n[Applying Fix] Creating SECURITY DEFINER function public.is_admin()...")
    cur.execute("""
        CREATE OR REPLACE FUNCTION public.is_admin()
        RETURNS BOOLEAN
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        STABLE
        AS $$
          SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE (auth_user_id = auth.uid() OR id = auth.uid())
              AND role = 'ADMIN'
              AND is_active = TRUE
          );
        $$;
    """)

    # Grant execute to authenticated and anon
    cur.execute("""
        GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
    """)
    print("  -> public.is_admin() created and granted.")

    # 3. Drop recursive policy
    print("\n[Applying Fix] Recreating users_select_admin policy with non-recursive check...")
    cur.execute("DROP POLICY IF EXISTS users_select_admin ON public.users;")
    cur.execute("""
        CREATE POLICY users_select_admin ON public.users
            FOR SELECT TO authenticated
            USING (public.is_admin());
    """)
    print("  -> users_select_admin policy recreated successfully.")

    # 4. Verify updated policies
    cur.execute("""
        SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        WHERE cls.relname = 'users';
    """)
    updated_policies = cur.fetchall()
    print("\n[Updated Policies on public.users]")
    for p in updated_policies:
        print(f"  * {p[0]} (Cmd: {p[1]}): {p[2]}")

    cur.close()
    conn.close()
    print("\nRLS Policy Repair Applied Successfully!")

if __name__ == "__main__":
    fix_rls()
