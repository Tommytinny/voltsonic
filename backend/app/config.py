from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_postgres_url(url: str, driver: str) -> str:
    normalized = url.strip()

    if normalized.startswith("postgres://"):
        normalized = "postgresql://" + normalized[len("postgres://"):]

    if normalized.startswith("postgresql+"):
        scheme, rest = normalized.split("://", 1)
        scheme = scheme.split("+", 1)[0]
        normalized = f"{scheme}://{rest}"

    if normalized.startswith("postgresql://"):
        normalized = f"postgresql+{driver}://" + normalized[len("postgresql://"):]

    if driver == "asyncpg":
        normalized = normalized.replace("sslmode=require", "ssl=require")
        normalized = normalized.replace("sslmode=disable", "ssl=disable")

    return normalized


class Settings(BaseSettings):
    app_name: str = "VoltSonic API"
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    api_reload: bool = True
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/voltsonic"
    voltsonic_rpc_urls: str = ""
    voltsonic_contract_address: str = ""
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    scheduler_interval: int = 5  # Run scheduler every N seconds

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def normalize_database_urls(self) -> "Settings":
        self.database_url = _normalize_postgres_url(self.database_url, "asyncpg")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
