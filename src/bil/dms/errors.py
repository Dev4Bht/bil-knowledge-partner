class DmsError(Exception):
    """Base class for domain errors; the API maps subclasses to HTTP codes."""


class NotFoundError(DmsError):
    """Maps to 404. Also used when a record exists but the user may not read it."""


class ConflictError(DmsError):
    """Maps to 409."""


class ValidationFailed(DmsError):
    """Maps to 422."""
