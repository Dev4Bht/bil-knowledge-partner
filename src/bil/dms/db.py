from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    return create_engine(url, connect_args={"check_same_thread": False})


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(engine, expire_on_commit=False)


def init_db(engine: Engine) -> None:
    from . import models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(engine)
