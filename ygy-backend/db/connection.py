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