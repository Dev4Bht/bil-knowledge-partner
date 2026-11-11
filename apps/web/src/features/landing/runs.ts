// Recorded from real runs of the demo on 11 Nov 2026 (Qwen3 8B and BGE-M3 on a laptop, staff account).
// Nothing here is written by hand: the steps, answers, sources and drafts are exactly what the system returned,
// except that whitespace is collapsed and, for the answered run, the snippets are the exact sentences from the stored page text
// (the API returns only the first 320 characters of a passage, which stop before the sentence that was cited). The conflict run uses the labelled fictional test documents.
// To refresh: ask the same questions through /chat/ask and replace the data.

export type RunKind = "answered" | "declined" | "conflict";

export type RunStep = { agent: string; text: string; seconds: number };
export type RunSource = { title: string; version: string; section: string | null; page: number | null; snippet: string };
export type RunClaim = { text: string; sources: number[] };

export type Run = {
  kind: RunKind;
  question: string;
  totalSeconds: number;
  status: string;
  steps: RunStep[];
  claims: RunClaim[];
  sources: RunSource[];
  reason: string | null;
  draft: string;
  notes: string[];
  warning: string | null;
};

export const RECORDED_ON = "11 Nov 2026";

export const RUNS: Run[] = [
  {
    "kind": "answered",
    "question": "How quickly must a financial service provider acknowledge a consumer complaint, and how long does a consumer have to refer it to the RMA?",
    "totalSeconds": 28.0,
    "status": "answered",
    "steps": [
      {
        "agent": "Supervisor",
        "text": "planned the search: 4 query(ies), intent answer",
        "seconds": 3.4
      },
      {
        "agent": "Retrieval",
        "text": "8 passage(s) from 2 document(s), hybrid search, access filtered",
        "seconds": 0.6
      },
      {
        "agent": "Policy & Version",
        "text": "0 notice(s), 0 conflict(s) among current documents",
        "seconds": 8.4
      },
      {
        "agent": "Synthesis",
        "text": "2 claim(s) drafted from 5 of 8 passage(s)",
        "seconds": 8.8
      },
      {
        "agent": "Verification",
        "text": "2 claim(s) verified, 0 rejected",
        "seconds": 4.6
      },
      {
        "agent": "Bilingual Response",
        "text": "English ready, Dzongkha not available",
        "seconds": 2.1
      }
    ],
    "claims": [
      {
        "text": "A financial service provider must acknowledge a consumer complaint within a maximum of 3 working days.",
        "sources": [
          1
        ]
      },
      {
        "text": "A consumer has a maximum of 30 days to refer a complaint to the RMA after the outcome of the assessment by the FSPs.",
        "sources": [
          2
        ]
      }
    ],
    "sources": [
      {
        "title": "Consumer Protection for Financial Services Rules and Regulations 2019",
        "version": "2019",
        "section": "§3.2.6 Complaints Handling and Redressal",
        "page": 11,
        "snippet": "The timelines stipulated by the RMA are: i. Acknowledgement of complaints within maximum of 3 working days; ii. Provision of reference numbers for all complaints received; iii. FSPs shall endeavor to settle the complaints within 45 working days (maximum) after receipt of the complaint."
      },
      {
        "title": "Consumer Protection for Financial Services Rules and Regulations 2019",
        "version": "2019",
        "section": "§3.2.6 Complaints Handling and Redressal",
        "page": 12,
        "snippet": "iv. In the event of consumer dissatisfaction or FSPs inability to resolve the complaints, consumers or FSPs may refer the complaint to the RMA within 30 days (maximum) of the outcome of the assessment by the FSPs"
      }
    ],
    "reason": null,
    "draft": "We acknowledge your complaint within 3 working days. You have 30 days to refer your complaint to the RMA after the FSP's assessment. If you need further assistance, please contact us.",
    "notes": [
      "No Dzongkha translation model is installed on this server, so no Dzongkha draft is shown."
    ],
    "warning": null
  },
  {
    "kind": "declined",
    "question": "What was BIL's share price at the close of trading yesterday?",
    "totalSeconds": 18.6,
    "status": "no_evidence",
    "steps": [
      {
        "agent": "Supervisor",
        "text": "planned the search: 4 query(ies), intent answer",
        "seconds": 3.2
      },
      {
        "agent": "Retrieval",
        "text": "8 passage(s) from 4 document(s), hybrid search, access filtered",
        "seconds": 0.2
      },
      {
        "agent": "Policy & Version",
        "text": "0 notice(s), 0 conflict(s) among current documents",
        "seconds": 3.1
      },
      {
        "agent": "Synthesis",
        "text": "0 claim(s) drafted from 8 of 8 passage(s)",
        "seconds": 6.1
      },
      {
        "agent": "Verification",
        "text": "no answerable claims; retrying retrieval once",
        "seconds": 0.0
      },
      {
        "agent": "Retrieval",
        "text": "12 passage(s) from 5 document(s), hybrid search, access filtered",
        "seconds": 0.2
      },
      {
        "agent": "Policy & Version",
        "text": "0 notice(s), 0 conflict(s) among current documents",
        "seconds": 1.6
      },
      {
        "agent": "Synthesis",
        "text": "0 claim(s) drafted from 12 of 12 passage(s)",
        "seconds": 4.1
      },
      {
        "agent": "Verification",
        "text": "no answerable claims; abstaining",
        "seconds": 0.0
      }
    ],
    "claims": [],
    "sources": [],
    "reason": "The evidence does not provide information about BIL's share price at the close of trading yesterday.",
    "draft": "",
    "notes": [],
    "warning": null
  },
  {
    "kind": "conflict",
    "question": "Within how many working days must a settled claim be paid after approval?",
    "totalSeconds": 14.3,
    "status": "conflict",
    "steps": [
      {
        "agent": "Supervisor",
        "text": "planned the search: 4 query(ies), intent answer",
        "seconds": 3.0
      },
      {
        "agent": "Retrieval",
        "text": "8 passage(s) from 6 document(s), hybrid search, access filtered",
        "seconds": 0.3
      },
      {
        "agent": "Policy & Version",
        "text": "1 notice(s), 1 conflict(s) among current documents",
        "seconds": 7.6
      },
      {
        "agent": "Synthesis",
        "text": "2 conflicting statement(s) quoted from the documents",
        "seconds": 0.0
      },
      {
        "agent": "Verification",
        "text": "2 claim(s) verified, 0 rejected",
        "seconds": 3.3
      },
      {
        "agent": "Bilingual Response",
        "text": "skipped: documents conflict",
        "seconds": 0.0
      }
    ],
    "claims": [
      {
        "text": "Conflict: EVAL FIXTURE: Settlement Memo A (Settlement period) says “A settled claim must be paid within 10 working days of approval.”.",
        "sources": [
          1
        ]
      },
      {
        "text": "Conflict: EVAL FIXTURE: Settlement Memo B (Settlement period) says “A settled claim must be paid within 20 working days of approval.”.",
        "sources": [
          2
        ]
      }
    ],
    "sources": [
      {
        "title": "EVAL FIXTURE: Settlement Memo A",
        "version": "A",
        "section": "Settlement period",
        "page": null,
        "snippet": "A settled claim must be paid within 10 working days of approval."
      },
      {
        "title": "EVAL FIXTURE: Settlement Memo B",
        "version": "B",
        "section": "Settlement period",
        "page": null,
        "snippet": "A settled claim must be paid within 20 working days of approval."
      }
    ],
    "reason": "The current documents disagree. Ask the owning team which applies before replying to the customer.",
    "draft": "",
    "notes": [
      "No customer reply was drafted because the current documents conflict. Check with the owning team first."
    ],
    "warning": "Conflict between current documents: on Settlement period for a settled claim, EVAL FIXTURE: Settlement Memo A (Settlement period) says “A settled claim must be paid within 10 working days of approval.” while EVAL FIXTURE: Settlement Memo B (Settlement period) says “A settled claim must be paid within 20 working days of approval.”"
  }
];
