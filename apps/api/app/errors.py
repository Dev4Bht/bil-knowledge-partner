class ApiError(Exception):
    """A deliberate, user-facing error. Rendered as {"detail": message, "code": code}."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def not_found(what: str = "Not found") -> ApiError:
    # Same answer for "missing" and "not allowed", so existence never leaks.
    return ApiError(404, "not_found", what)
