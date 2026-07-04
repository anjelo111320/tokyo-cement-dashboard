from pydantic import BaseModel


class CsvFileConfig(BaseModel):
    filename: str
    enabled: bool


class CsvConfigSchema(BaseModel):
    csv_base_path: str
    refresh_interval_seconds: int
    files: dict[str, CsvFileConfig]


class IngestionJobResponse(BaseModel):
    job_id: str
    status: str
    message: str
