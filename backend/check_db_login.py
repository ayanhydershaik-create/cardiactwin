import getpass
import subprocess
import psycopg

password = getpass.getpass("Enter your PostgreSQL password: ")

print("\nTesting Python connection...")
try:
    with psycopg.connect(
        host="127.0.0.1",
        port=5432,
        dbname="cardiac_twin",
        user="cardiac_admin",
        password=password,
        connect_timeout=5,
    ) as conn:
        print("Python connection SUCCESS:", conn.execute(
            "SELECT current_user, current_database()"
        ).fetchone())
except Exception as exc:
    print("Python connection FAILED:", str(exc).splitlines()[0])

print("\nPassword length entered:", len(password))