from bil.dms.security import hash_password, make_token, read_token, verify_password


def test_password_roundtrip():
    stored = hash_password("s3cret")
    assert stored != "s3cret"
    assert verify_password("s3cret", stored)
    assert not verify_password("wrong", stored)


def test_verify_rejects_malformed_hash():
    assert not verify_password("x", "not-a-hash")


def test_same_password_hashes_differ():
    assert hash_password("a") != hash_password("a")


def test_token_roundtrip():
    token = make_token("secret", "alice")
    assert read_token("secret", token, max_age=60) == "alice"


def test_token_rejects_wrong_secret_and_garbage():
    token = make_token("secret", "alice")
    assert read_token("other", token, max_age=60) is None
    assert read_token("secret", "garbage", max_age=60) is None


def test_token_expires():
    token = make_token("secret", "alice")
    assert read_token("secret", token, max_age=-1) is None
