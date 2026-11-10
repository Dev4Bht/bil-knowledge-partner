"""The public documents to import: URLs and metadata only. The documents themselves are downloaded at import time
from the official sites and are never committed to git (data/ is git-ignored)."""

from urllib.parse import quote

BIL = "https://www.bil.bt"
RMA = "https://www.rma.org.bt/media/Laws_By_Laws/"

GI, CR, PF, CO = "general_insurance", "credit", "pf_gf", "corporate"


def bil_pdf(path: str) -> str:
    return f"{BIL}/document/{quote(path)}"


def rma_pdf(name: str) -> str:
    return RMA + quote(name)


# ---- PDFs: (title, business_line, folder, doc_type, publisher, [(label, url, effective_from or None)]) ----
PDFS = [
    ("BIL Insurance Handbook", GI, "Handbooks", "handbook", "Bhutan Insurance Limited",
     [("20 August 2024", bil_pdf("uploads/BIL-Insurance-Handbook-20August2024.pdf"), "2024-08-20")]),

    # BIL forms
    ("BIL Motor Insurance Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Motor-Claim-Form.pdf"), None)]),
    ("BIL Motor Insurance Proposal Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Motor-Proposal-Form.pdf"), None)]),
    ("BIL Claim Intimation Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Claim_Intimation_Form.pdf"), None)]),
    ("BIL Fire Insurance Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Fire-Claim-Form.pdf"), None)]),
    ("BIL Fire Insurance Proposal Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/FIRE INSURANCE PROPOSAL FORM.pdf"), None)]),
    ("BIL Burglary Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Burglary-Claim-Form.pdf"), None)]),
    ("BIL Marine Insurance Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Marine-Claim-Form.pdf"), None)]),
    ("BIL Personal Accident Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/PA-Claim-Form.pdf"), None)]),
    ("BIL Workmen's Compensation Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/WC-Claim-Form.pdf"), None)]),
    ("BIL Travel Insurance Proposal Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/TRAVEL-INSURANCE-PROPOSAL-FORM.pdf"), None)]),
    ("BIL Gyalsung Insurance Claim Form", GI, "Forms", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/gyalsup-claim-form.pdf"), None)]),
    ("BIL Loan Application Form", CR, "Product Sheets", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/loan_application_form.pdf"), None)]),
    ("BIL Loan Protection Claim Form", CR, "Product Sheets", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Loan-Protection-Claim-Form.pdf"), None)]),
    ("BIL PPF Memorandum of Understanding", PF, "Scheme Rules", "policy_wording", "Bhutan Insurance Limited", [("current", bil_pdf("forms/PPF-MOU.pdf"), None)]),
    ("BIL GF Memorandum of Understanding", PF, "Scheme Rules", "policy_wording", "Bhutan Insurance Limited", [("current", bil_pdf("forms/GF MoU Final.pdf"), None)]),
    ("BIL PF Contribution Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/pf_contribution_form.pdf"), None)]),
    ("BIL PF Refund Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/pf_refund_form.pdf"), None)]),
    ("BIL PF Employee Detail Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/pf_employe_detail_form.pdf"), None)]),
    ("BIL Nomination Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/Nomination_Form.pdf"), None)]),
    ("BIL Change of Nominee Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/change_of_nominee_form.pdf"), None)]),
    ("BIL Minor Nominee Form", PF, "Procedures", "form", "Bhutan Insurance Limited", [("current", bil_pdf("forms/minor_nominee_form.pdf"), None)]),

    # RMA regulations (insurance)
    ("The Financial Services Act of Bhutan 2011", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2011", rma_pdf("The Financial Services  Act of Bhutan, 2011.pdf"), None)]),
    ("Rules and Regulations for Insurance and Re-insurance Companies", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("current", rma_pdf("Rules and Regulations for Insurance and Re-insurance Companies.pdf"), None)]),
    ("Rules and Regulation for Licensing of Insurance Companies in Bhutan 2018", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2018", rma_pdf("Rules and Regulation for licensing of Insurance  Companies in Bhutan 2018.pdf"), None)]),
    ("Guideline on Risk Based Solvency and Capital Requirements for Insurance and Reinsurance Companies 2025", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2025", rma_pdf("Guideline on Risk Based Solvency and Capital Requirements for Insurance and Reinsurance Companies 2025.pdf"), None)]),
    ("Insurance Broker Regulation 2011", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2011", rma_pdf("Insurance Broker Regulation, 2011.pdf"), None)]),
    ("Loss Adjuster Regulations 2012", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2012", rma_pdf("Loss Adjuster Regulations, 2012.pdf"), None)]),
    ("Regulations for Establishment of Reinsurance Business in Bhutan", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("current", rma_pdf("Regulations for Establishment of Reinsurance Business in Bhutan.pdf"), None)]),
    ("AML and CFT Guidelines for Insurance Companies 2020", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2020", rma_pdf("AML and CFT Guidelines for Insurance Companies 2020.pdf"), None)]),
    ("Consumer Protection for Financial Services Rules and Regulations 2019", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2019", rma_pdf("Consumer Protection for Financial Services  (CPFS)  Rules and Regulations 2019.pdf"), None)]),
    ("Corporate Governance Rules and Regulations 2024", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2024", rma_pdf("Corporate Governance Rules and Regulations, 2024.pdf"), None)]),
    ("Fit and Proper Guidelines 2022", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2022", rma_pdf("Fit and Proper Guidelines, 2022 .pdf"), None)]),
    ("Guidelines on Data Privacy and Data Protection 2021 for Financial Service Providers", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2021", rma_pdf("GuidelinesonDataPrivacyandDataProtection2021forFSPs.pdf"), None)]),
    ("Cybersecurity Directives for Non-Bank Financial Institutions", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("current", rma_pdf("CybersecurityDirectivesforNon-BankFinancialInstitutions(NBFI).pdf"), None)]),
    ("Rules and Regulations for Accountability of Key Responsible Persons of Regulated Entities 2022", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2022", rma_pdf("RULES AND REGULATIONS FOR ACCOUNTABILITY OF KEY RESPONSIBLE PERSONS OF REGULATED ENTITIES, 2022.pdf"), None)]),
    ("Penalty Rules and Regulations 2022", CO, "RMA Regulations", "guideline", "Royal Monetary Authority of Bhutan", [("2022", rma_pdf("Penalty Rules and Regulations 2022 .pdf"), None)]),

    # RMA regulations (credit). The RMA site links a 2017 edition of the Prudential Regulations but that URL returns 404
    # (checked 2026-11-10), so only the 2024 edition can be imported.
    ("Prudential Regulations 2024", CR, "Policy and Manuals", "guideline", "Royal Monetary Authority of Bhutan",
     [("2024", rma_pdf("Prudential Regulations, 2024.pdf"), None)]),
    ("Rules and Regulation on Loan Origination and Monitoring 2022", CR, "Policy and Manuals", "guideline", "Royal Monetary Authority of Bhutan", [("2022", rma_pdf("Rules and regulation on Loan origination and monitoring 2022.pdf"), None)]),
    ("Rules and Regulation on Loan Restructuring by FSPs 2022", CR, "Policy and Manuals", "guideline", "Royal Monetary Authority of Bhutan", [("2022", rma_pdf("Rules and Regulation on Loan Restructuring by FSPs, 2022.pdf"), None)]),
    ("Directive on Housing, Vehicle and Personal Loans 2021", CR, "Policy and Manuals", "guideline", "Royal Monetary Authority of Bhutan", [("2021", rma_pdf("Directive on Housing (commercial and home) Loans, Vehicle Loans and Personal Loans, 2021.pdf"), None)]),
]

# ---- BIL web pages, converted to text: (path, business_line, folder, doc_type) ----
WEB = [(p, GI, "Products", "product_catalogue") for p in [
    "insurance", "insurance/motor-insurance", "insurance/motor-insurance/comprehensive-insurance",
    "insurance/motor-insurance/third-party-insurance", "insurance/motor-insurance/road-transit-insurance",
    "insurance/fire-insurance", "insurance/fire-insurance/standard-fire-insurance",
    "insurance/fire-insurance/industrial-all-risk-policy", "insurance/fire-insurance/rural-dwelling-insurance",
    "insurance/travel-insurance", "insurance/travel-insurance/nye-kora-travel-insurance",
    "insurance/travel-insurance/bhutan-travel-insurance", "insurance/travel-insurance/global-travel-insurance",
    "insurance/engineering", "insurance/engineering/contractor-s-all-risk", "insurance/engineering/contractor-s-plant-machinery",
    "insurance/engineering/erection-all-risk-insurance", "insurance/aviation-insurance", "insurance/marine-insurance",
    "insurance/marine-insurance/open-cover-policy", "insurance/marine-insurance/specific-voyage",
    "insurance/liability-insurance", "insurance/liability-insurance/directors-officers-liability",
    "insurance/liability-insurance/liability", "insurance/liability-insurance/professional-indemnity",
    "insurance/liability-insurance/workman-compensation", "insurance/miscellaneous-insurance",
    "insurance/miscellaneous-insurance/burglary-policy", "insurance/miscellaneous-insurance/cash-in-safe",
    "insurance/miscellaneous-insurance/cash-in-transit", "insurance/miscellaneous-insurance/fidelity-guarantee",
    "insurance/miscellaneous-insurance/loan-protection", "insurance/miscellaneous-insurance/personal-accident",
    "insurance/miscellaneous-insurance/sports-insurance", "gmc/insurance", "gmc/insurance/health-insurance",
    "gmc/insurance/workman-compensation"]] + \
    [(p, GI, "Claims", "guideline") for p in [
        "claim", "claim/motor-insurance-claim", "claim/fire-insurance-claim", "claim/travel-insurance-claim",
        "claim/engineering-insurance-claim", "claim/aviation-insurance-claim", "claim/marine-insurance-claim",
        "claim/liability-insurance-claim", "claim/miscellaneous-insurance-claim"]] + \
    [("loans", CR, "Product Sheets", "product_catalogue"), ("loan-emi-calculator", CR, "Product Sheets", "other"),
     ("ppf-gf", PF, "Scheme Rules", "policy_wording"),
     ("privacy-policy", CO, "Public Information", "other"), ("about-us/information-security", CO, "Public Information", "other"),
     ("about-us/company-profile", CO, "Public Information", "other"), ("customer-information/insurance-policy", GI, "Products", "other"),
     ("unclaimed-dividend", CO, "Public Information", "other")]
