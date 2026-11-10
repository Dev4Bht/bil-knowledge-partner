import re

# Bhutanese CID numbers are 11 digits. Longer or shorter digit runs are not matched.
_CID = re.compile(r"(?<!\d)\d{11}(?!\d)")


def scan_text(text: str) -> list[dict]:
    findings = []
    for match in _CID.finditer(text):
        value = match.group()
        findings.append({"kind": "cid_number", "masked": f"{value[:4]}***{value[-2:]}"})
    return findings
