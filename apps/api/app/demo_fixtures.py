"""Fictional demo documents. They are NOT BIL policy and are flagged is_demo_fixture in the database.

They exist to exercise every case the product must handle: an old version superseded by a newer one, two
current documents that disagree (a conflict), a draft only managers see, and a restricted document.
"""

from datetime import date

BANNER = "FICTIONAL DEMO FIXTURE - not BIL policy."


def _t(text: str) -> str:
    return f"{BANNER}\n\n{text.strip()}\n"


MOTOR_2022 = _t("""
Motor Insurance Handbook (2022 edition)

1. Scope
This handbook describes comprehensive and third-party motor cover.

4. Natural calamity
4.1 Flood damage
Flood damage is not covered under the comprehensive motor policy unless the Flood Extension was purchased.

5. Claims
5.1 Reporting
A claim must be reported within 7 days of the loss.
""")

MOTOR_2024 = _t("""
Motor Insurance Handbook (2024 edition)

1. Scope
This handbook describes comprehensive and third-party motor cover.

4. Natural calamity
4.1 Flood damage
Flood damage is treated as a natural calamity and is covered under the comprehensive motor policy, subject to the policy exclusions and the applicable excess.
4.2 Exclusions
Damage caused by driving into floodwater against a posted warning is excluded.

5. Claims
5.1 Reporting
A claim must be reported within 7 days of the loss.
5.2 Documents
The customer submits the claim form, photographs of the damage, a copy of the driving licence, a copy of the vehicle registration and an estimate from an approved workshop.
""")

CLAIMS_SOP = _t("""
Claims SOP - Motor (revision 2)

Step 1. Register the claim
Record the loss date, the policy number and the reporting date in the claims register.

Step 2. Collect documents
Collect the claim form, photographs, a copy of the driving licence, a copy of the vehicle registration and an estimate from an approved workshop.

Step 3. Survey
Assign a surveyor for any claim above Nu 50,000. Smaller claims may be assessed from photographs.

Step 4. Settlement
Settle within 15 working days of receiving all documents.
""")

CIRCULAR = _t("""
Circular 2024/017 - Motor Claims

1. Purpose
This circular updates the reporting period for motor claims.

2. Reporting period
Motor claims must be reported within 14 days of the loss.

3. Effective date
This circular takes effect on 1 July 2024.
""")

FIRE_V1 = _t("""
Fire Policy Renewal Checklist

1. Documents for renewal
The customer provides the expiring policy schedule, a signed renewal form and proof of premium payment.

2. Changes in risk
If the building use or sum insured has changed, the customer completes the risk change declaration.
""")

FIRE_V2_DRAFT = _t("""
Fire Policy Renewal Checklist (draft revision)

1. Documents for renewal
The customer provides the expiring policy schedule, a signed renewal form, proof of premium payment and a recent photograph of the insured building.

2. Changes in risk
If the building use or sum insured has changed, the customer completes the risk change declaration.
""")

HOUSING_LOAN = _t("""
Housing Loan SOP

1. Eligibility
The applicant must be a salaried employee with at least two years of service or a registered business owner.

2. Eligibility steps
Step 1: verify identity and employment. Step 2: check repayment capacity using the appraisal template. Step 3: confirm the property documents. Step 4: submit to the credit committee.
""")

PARTIAL_WITHDRAWAL = _t("""
Partial Withdrawal Procedure (PF/GF)

1. When a partial withdrawal is allowed
A member may request a partial withdrawal for housing, education or medical needs.

2. Procedure
Step 1: the member submits the withdrawal form with supporting documents. Step 2: the desk officer checks the member balance. Step 3: the manager approves. Step 4: payment is made to the member's bank account within 10 working days.
""")

CHARTER = _t("""
Customer Service Charter

1. Our commitment
We acknowledge every customer query within one working day.

2. Language
We reply in English or Dzongkha, as the customer prefers.
""")

CATALOGUE = _t("""
Motor Product Catalogue 2025

1. Comprehensive motor
Covers own damage, theft and natural calamity, subject to exclusions.

2. Third-party motor
Covers legal liability for injury to others and damage to their property.
""")

BRIEFING = _t("""
Management Briefing - Claims Procedure Changes (restricted)

1. Summary
The claims reporting period is under review. No change has been decided. This briefing is for managers only.
""")

# line = business line code; folder = top-level folder name; versions are oldest first; approve=False leaves a draft.
FIXTURES = [
    dict(title="Motor Insurance Handbook", description="Cover rules and claim steps for motor insurance.",
         line="general_insurance", folder="Handbooks", classification="staff", roles=[], filename="Motor_Insurance_Handbook.txt",
         versions=[dict(label="2022", text=MOTOR_2022, effective_from=date(2022, 1, 1), approve=True),
                   dict(label="2024", text=MOTOR_2024, effective_from=date(2024, 1, 1), approve=True)]),
    dict(title="Claims SOP - Motor", description="Step by step claims handling for motor.",
         line="general_insurance", folder="SOPs", classification="staff", roles=[], filename="Claims_SOP_Motor_rev2.txt",
         versions=[dict(label="rev2", text=CLAIMS_SOP, effective_from=date(2022, 6, 1), approve=True)]),
    dict(title="Circular 2024/017 Motor Claims", description="Updates the motor claim reporting period.",
         line="corporate", folder="Circulars", classification="staff", roles=[], filename="Circular_2024_017_motor_claims.txt",
         versions=[dict(label="2024/017", text=CIRCULAR, effective_from=date(2024, 7, 1), approve=True)]),
    dict(title="Fire Policy Renewal Checklist", description="Documents needed to renew a fire policy.",
         line="general_insurance", folder="Forms", classification="staff", roles=[], filename="Fire_Renewal_Checklist.txt",
         versions=[dict(label="v1", text=FIRE_V1, effective_from=date(2023, 3, 1), approve=True),
                   dict(label="v2-draft", text=FIRE_V2_DRAFT, effective_from=date(2026, 1, 1), approve=False)]),
    dict(title="Motor Product Catalogue 2025", description="Motor products on offer.",
         line="general_insurance", folder="Products", classification="public", roles=[], filename="Motor_Product_Catalogue_2025.txt",
         versions=[dict(label="2025", text=CATALOGUE, effective_from=date(2025, 1, 1), approve=True)]),
    dict(title="Housing Loan SOP", description="Eligibility and appraisal steps for housing loans.",
         line="credit", folder="Policy and Manuals", classification="staff", roles=[], filename="Housing_Loan_SOP.txt",
         versions=[dict(label="v1", text=HOUSING_LOAN, effective_from=date(2023, 9, 1), approve=True)]),
    dict(title="PF/GF Partial Withdrawal Procedure", description="How a partial withdrawal is processed.",
         line="pf_gf", folder="Procedures", classification="staff", roles=[], filename="PFGF_Partial_Withdrawal.txt",
         versions=[dict(label="v1", text=PARTIAL_WITHDRAWAL, effective_from=date(2023, 5, 1), approve=True)]),
    dict(title="Customer Service Charter", description="Commitments to customers.",
         line="corporate", folder="Forms", classification="public", roles=[], filename="Customer_Service_Charter.txt",
         versions=[dict(label="v1", text=CHARTER, effective_from=date(2023, 1, 1), approve=True)]),
    dict(title="Management Briefing: Claims Procedure Changes", description="Managers only.",
         line="corporate", folder="Training", classification="restricted", roles=["manager"], filename="Management_Briefing.txt",
         versions=[dict(label="v1", text=BRIEFING, effective_from=date(2026, 1, 1), approve=True)]),
]
