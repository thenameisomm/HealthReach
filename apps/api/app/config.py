"""Central server-side configuration. All secrets stay here; never sent to the client."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=[".env", "../../.env"], extra="ignore")

    MONGODB_URI: str = "mongodb://localhost:27017/healthreach"
    QLOO_API_KEY: str = ""
    QLOO_BASE_URL: str = "https://api.qloo.com"
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    CORS_ORIGINS: str = "http://localhost:3000"
    API_PORT: int = 8000

    @property
    def qloo_configured(self) -> bool:
        return bool(self.QLOO_API_KEY.strip())

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_API_KEY.strip())

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
