const now = new Date();

function isoMinutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function createSeedData() {
  return {
    runs: [
      {
        id: "run_salesforce_sync_001",
        workflowId: "salesforce-account-enrichment",
        status: "recovered",
        createdAt: isoMinutesAgo(220),
        updatedAt: isoMinutesAgo(140),
        metadata: {
          customer: "Northwind Ops",
          environment: "production",
          framework: "langgraph"
        },
        input: {
          accountId: "acct_481",
          trigger: "webhook"
        },
        checkpoints: [
          {
            id: "chk_fetch_crm",
            stepId: "fetch_crm",
            stepName: "Fetch CRM context",
            state: {
              accountId: "acct_481",
              freshness: "fresh"
            },
            output: {
              companyName: "Northwind",
              owner: "Hale"
            },
            toolEvents: [
              {
                id: "tool_crm_1",
                toolName: "crm.lookup",
                status: "success",
                latencyMs: 340,
                input: {
                  accountId: "acct_481"
                },
                output: {
                  companyName: "Northwind"
                }
              }
            ],
            idempotent: true,
            createdAt: isoMinutesAgo(218)
          },
          {
            id: "chk_generate_email",
            stepId: "generate_email",
            stepName: "Generate outreach draft",
            state: {
              persona: "finance-ops",
              source: "crm+kb"
            },
            output: {
              draftStatus: "partial"
            },
            toolEvents: [
              {
                id: "tool_llm_1",
                toolName: "llm.generate",
                status: "success",
                latencyMs: 1240,
                input: {
                  promptVersion: "v7"
                },
                output: {
                  tokens: 1820
                }
              }
            ],
            idempotent: true,
            createdAt: isoMinutesAgo(210)
          },
          {
            id: "chk_write_email",
            stepId: "write_email",
            stepName: "Write draft to outbound system",
            state: {
              draftId: "draft_93"
            },
            output: {
              writeAttempt: 1
            },
            toolEvents: [
              {
                id: "tool_outbound_1",
                toolName: "outbound.createDraft",
                status: "timeout",
                latencyMs: 12000,
                input: {
                  campaignId: "cmp_9"
                },
                output: null
              }
            ],
            idempotent: false,
            createdAt: isoMinutesAgo(205)
          }
        ],
        failures: [
          {
            id: "fail_001",
            type: "tool_timeout",
            severity: "high",
            message: "Outbound draft write timed out at final step.",
            createdAt: isoMinutesAgo(204),
            checkpointId: "chk_write_email",
            payload: {
              toolName: "outbound.createDraft",
              retryClass: "guarded"
            }
          }
        ],
        approvals: [
          {
            id: "approval_001",
            stepId: "write_email",
            status: "approved",
            requestedAt: isoMinutesAgo(185),
            resolvedAt: isoMinutesAgo(180),
            action: {
              mode: "retry_with_guard"
            }
          }
        ],
        replays: [
          {
            id: "replay_001",
            scenario: "resume_after_timeout",
            createdAt: isoMinutesAgo(178),
            fromCheckpointId: "chk_generate_email"
          }
        ],
        metrics: {
          tokenBurn: 1820,
          totalLatencyMs: 15580,
          recoveryCount: 1
        }
      },
      {
        id: "run_support_triage_002",
        workflowId: "support-triage",
        status: "failed",
        createdAt: isoMinutesAgo(90),
        updatedAt: isoMinutesAgo(65),
        metadata: {
          customer: "Beacon Support",
          environment: "production",
          framework: "custom"
        },
        input: {
          ticketId: "tk_912",
          channel: "email"
        },
        checkpoints: [
          {
            id: "chk_load_ticket",
            stepId: "load_ticket",
            stepName: "Load ticket payload",
            state: {
              source: "zendesk"
            },
            output: {
              bodyPresent: true
            },
            toolEvents: [],
            idempotent: true,
            createdAt: isoMinutesAgo(89)
          },
          {
            id: "chk_classify_ticket",
            stepId: "classify_ticket",
            stepName: "Classify issue",
            state: {
              classifier: "gpt-4.1-mini"
            },
            output: {
              malformed: true
            },
            toolEvents: [
              {
                id: "tool_llm_2",
                toolName: "llm.classify",
                status: "success",
                latencyMs: 940,
                input: {
                  promptVersion: "v12"
                },
                output: {
                  rawShape: "missing priority"
                }
              }
            ],
            idempotent: true,
            createdAt: isoMinutesAgo(83)
          }
        ],
        failures: [
          {
            id: "fail_002",
            type: "schema_validation",
            severity: "medium",
            message: "Classifier output missing required priority field.",
            createdAt: isoMinutesAgo(82),
            checkpointId: "chk_classify_ticket",
            payload: {
              expectedSchema: "support-triage-v3"
            }
          }
        ],
        approvals: [],
        replays: [],
        metrics: {
          tokenBurn: 640,
          totalLatencyMs: 1840,
          recoveryCount: 0
        }
      },
      {
        id: "run_research_digest_003",
        workflowId: "research-digest",
        status: "running",
        createdAt: isoMinutesAgo(25),
        updatedAt: isoMinutesAgo(3),
        metadata: {
          customer: "Atlas Labs",
          environment: "pilot",
          framework: "langgraph"
        },
        input: {
          topic: "agent observability"
        },
        checkpoints: [
          {
            id: "chk_collect_sources",
            stepId: "collect_sources",
            stepName: "Collect sources",
            state: {
              sourceCount: 12
            },
            output: {
              sourceCount: 12
            },
            toolEvents: [],
            idempotent: true,
            createdAt: isoMinutesAgo(24)
          }
        ],
        failures: [],
        approvals: [],
        replays: [],
        metrics: {
          tokenBurn: 210,
          totalLatencyMs: 4400,
          recoveryCount: 0
        }
      }
    ],
    policies: [
      {
        id: "policy_schema_guard",
        name: "Schema Guard",
        type: "validation",
        action: "block",
        target: "all_llm_outputs",
        description: "Reject malformed structured outputs before downstream tools run."
      },
      {
        id: "policy_sensitive_write_approval",
        name: "Sensitive Write Approval",
        type: "approval",
        action: "require-human",
        target: "non_idempotent_external_writes",
        description: "Request approval before retrying non-idempotent actions."
      },
      {
        id: "policy_timeout_retry",
        name: "Timeout Retry",
        type: "retry",
        action: "guarded",
        target: "tool_timeout",
        description: "Allow one guarded retry with replay from last safe checkpoint."
      }
    ],
    evalScenarios: [
      {
        id: "scenario_tool_timeout_final_step",
        name: "Tool timeout at final step",
        description: "Simulates a timeout on a non-idempotent write near workflow completion.",
        expectedOutcome: "pause-and-approve"
      },
      {
        id: "scenario_malformed_output",
        name: "Malformed structured output",
        description: "Model returns JSON missing required fields.",
        expectedOutcome: "schema-block"
      },
      {
        id: "scenario_stale_context",
        name: "Stale context injected mid-run",
        description: "Context timestamp is older than freshness policy.",
        expectedOutcome: "validation-failure"
      },
      {
        id: "scenario_duplicate_webhook",
        name: "Duplicate webhook event",
        description: "A repeated event attempts to create duplicate side effects.",
        expectedOutcome: "idempotent-skip"
      }
    ]
  };
}

module.exports = {
  createSeedData
};

