import os
import oracledb
from dotenv import load_dotenv

load_dotenv()

connection = oracledb.connect(
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    dsn=os.getenv("DB_DSN"),
    config_dir=os.getenv("WALLET_LOCATION"),
    wallet_location=os.getenv("WALLET_LOCATION"),
    wallet_password=os.getenv("WALLET_PASSWORD"),
)
cursor = connection.cursor()

with open("db/schema.sql", "r") as f:
    sql_content = f.read()

# 세미콜론 기준으로 각 CREATE TABLE 문 분리해서 하나씩 실행
statements = [s.strip() for s in sql_content.split(";") if s.strip()]

for i, stmt in enumerate(statements, 1):
    try:
        cursor.execute(stmt)
        print(f"[{i}/{len(statements)}] SUCCESS: {stmt.splitlines()[0][:50]}...")
    except oracledb.DatabaseError as e:
        print(f"[{i}/{len(statements)}] FAILED: {stmt.splitlines()[0][:50]}...")
        print(f"   Error: {e}")

connection.commit()
cursor.close()
connection.close()
print("Done executing schema.sql and committed changes.")