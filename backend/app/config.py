from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)

    gemini_api_key: str
    groq_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    frontend_url: str = "http://localhost:3000"

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_url, "http://localhost:3000"]
        return list(set(origins))


settings = Settings()
