import oracledb
import os
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    return oracledb.connect(
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dsn=os.getenv("DB_DSN"),
        config_dir=os.getenv("WALLET_LOCATION"),
        wallet_location=os.getenv("WALLET_LOCATION"),
        wallet_password=os.getenv("WALLET_PASSWORD"),
    )


def execute_and_commit(query, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params or {})
    row_count = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return row_count


def fetch_all(query, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params or {})
    columns = [col[0].lower() for col in cursor.description]
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def fetch_one(query, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params or {})
    columns = [col[0].lower() for col in cursor.description]
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(zip(columns, row)) if row else None