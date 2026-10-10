
import os

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "INFO"
    database_url: str

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    # Development-only authentication fixture.
    demo_auth_enabled: bool = True

    # Required for signed authentication tokens outside development.
    auth_token_secret: SecretStr | None = None

    # Confirmation references expire quickly.
    confirmation_ttl_seconds: int = Field(default=300, ge=30, le=900)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_settings(self):
        environment = self.app_env.strip().lower()

        if environment not in {"development", "test", "staging", "production"}:
            raise ValueError(
                "APP_ENV must be development, test, staging, or production"
            )

        if environment in {"staging", "production"}:
            if self.demo_auth_enabled:
                raise ValueError(
                    "DEMO_AUTH_ENABLED must be false outside development/test"
                )

            if self.auth_token_secret is None:
                raise ValueError(
                    "AUTH_TOKEN_SECRET is required outside development/test"
                )

            if len(self.auth_token_secret.get_secret_value()) < 32:
                raise ValueError(
                    "AUTH_TOKEN_SECRET must contain at least 32 characters"
                )

        return self


settings = Settings()
