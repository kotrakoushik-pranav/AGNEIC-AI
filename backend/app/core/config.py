from typing import Any, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    # Union[List[str], str] allows pydantic-settings to read the raw env value
    # without failing; the validator below normalises it to a list.
    cors_origins: Union[List[str], str] = ["http://localhost:5173", "http://localhost:3000"]
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",   # allow extra env vars (camera/recognition settings read via os.getenv)
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Accept either a comma-separated string or a JSON/list value."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
