"""
core/exceptions.py — Custom Exception Hierarchy
=================================================
Defines all application-specific exceptions. By raising these instead of
plain Python exceptions, the global error handler in main.py can convert
them into consistent, user-friendly JSON responses.

How the error flow works:
  Repository raises CsvReadError("file not found")
      ↓
  Service propagates it (doesn't catch it)
      ↓
  Route handler propagates it
      ↓
  FastAPI catches it via @app.exception_handler(AppError) in main.py
      ↓
  Client receives: { "success": false, "error": { "code": "CSV_READ_ERROR", ... } }

Used by:
  repositories/csv/csv_base.py         → raises CsvReadError
  repositories/csv/*_csv_repo.py       → raises CsvReadError, DataValidationError
  main.py                              → @app.exception_handler(AppError)
"""


class AppError(Exception):
    """
    Base class for all application errors.
    Every custom exception in this project must inherit from this class
    so the global error handler in main.py can catch them all in one place.

    Args:
        message: Human-readable description shown to the API client.
        code:    Machine-readable error code for the frontend to act on.
    """
    def __init__(self, message: str, code: str = "APP_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class CsvReadError(AppError):
    """
    Raised when a CSV file cannot be found, opened, or parsed.
    This typically happens if:
      - The file path in config is wrong.
      - The source system hasn't written the file yet.
      - The file is malformed (wrong delimiter, missing columns).
    """
    def __init__(self, message: str) -> None:
        super().__init__(message, "CSV_READ_ERROR")


class DataValidationError(AppError):
    """
    Raised when data from a CSV file fails business-rule validation.
    Example: a production record with a negative quantity, or a
    delivery with an unrecognised status value.
    """
    def __init__(self, message: str) -> None:
        super().__init__(message, "VALIDATION_ERROR")


class NotFoundError(AppError):
    """
    Raised when a requested resource (plant, vehicle, order) does not exist.
    Maps to a 404-like response in the error handler.
    """
    def __init__(self, message: str) -> None:
        super().__init__(message, "NOT_FOUND")
