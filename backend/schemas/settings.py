from pydantic import BaseModel


class CsvFileConfig(BaseModel):
    filename: str
    enabled: bool


class CsvConfigSchema(BaseModel):
    csv_base_path: str
    refresh_interval_seconds: int
    files: dict[str, CsvFileConfig]


class CsvConfigUpdateRequest(BaseModel):
    csv_base_path: str | None = None
    refresh_interval_seconds: int | None = None


class IngestionJobResponse(BaseModel):
    job_id: str
    status: str
    message: str
