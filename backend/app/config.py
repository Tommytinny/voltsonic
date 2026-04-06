from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "VoltSonic API"
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    api_reload: bool = True
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voltsonic"
    sync_database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/voltsonic"
    voltsonic_rpc_url: str = ""
    voltsonic_contract_address: str = ""
    indexer_start_block: int = 0
    indexer_block_chunk_size: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
